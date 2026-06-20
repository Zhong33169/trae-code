import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors, UploadedFile, ParseFilePipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { SubmitDto } from './dto/submit.dto';
import { ApproveDto } from './dto/approve.dto';
import { RejectDto } from './dto/reject.dto';
import { ReviewDto } from './dto/review.dto';
import { ReviewRejectDto } from './dto/review-reject.dto';
import { BatchActionDto } from './dto/batch-action.dto';
import { GuestConfirmDto } from './dto/guest-confirm.dto';
import { CheckinFeedbackDto } from './dto/checkin-feedback.dto';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly service: InvitationService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('stats')
  getStats(@Query('role') role?: string, @Query('operatorId') operatorId?: string) {
    return this.service.getStats(role, operatorId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInvitationDto & { operatorId: string; operatorRole: string }) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvitationDto & { operatorId: string; operatorRole: string }) {
    return this.service.update(id, dto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitDto) {
    return this.service.submit(id, dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.service.approve(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto) {
    return this.service.reject(id, dto);
  }

  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.service.review(id, dto);
  }

  @Post(':id/review-reject')
  reviewReject(@Param('id') id: string, @Body() dto: ReviewRejectDto) {
    return this.service.reviewReject(id, dto);
  }

  @Post(':id/reprocess')
  reprocess(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.service.reprocess(id, dto);
  }

  @Post('batch')
  batchAction(@Body() dto: BatchActionDto) {
    return this.service.batchAction(dto);
  }

  @Post(':id/materials')
  @UseInterceptors(FileInterceptor('file'))
  addMaterial(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('operatorId') operatorId: string,
  ) {
    return this.service.addMaterial(id, file, operatorId);
  }

  @Post(':id/guest-confirm')
  guestConfirm(@Param('id') id: string, @Body() dto: GuestConfirmDto) {
    return this.service.guestConfirm(id, dto);
  }

  @Post(':id/checkin-feedback')
  checkinFeedback(@Param('id') id: string, @Body() dto: CheckinFeedbackDto) {
    return this.service.checkinFeedback(id, dto);
  }
}
