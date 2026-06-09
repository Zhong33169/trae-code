import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TreatmentPlanService } from './treatment-plan.service';
import {
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanDto,
  QueryTreatmentPlanDto,
  SubmitVerificationDto,
  VerifyTreatmentPlanDto,
  SubmitReviewDto,
  ReviewTreatmentPlanDto,
  BatchOperationDto,
  AddAttachmentDto,
} from './dto/treatment-plan.dto';

@Controller('treatment-plans')
export class TreatmentPlanController {
  constructor(private readonly service: TreatmentPlanService) {}

  @Get()
  findAll(@Query() query: QueryTreatmentPlanDto) {
    return this.service.findAll(query);
  }

  @Get('stats')
  getStats(@Query('userId') userId: string) {
    return this.service.getStats(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('userId') userId: string) {
    return this.service.findOne(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTreatmentPlanDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTreatmentPlanDto,
    @Query('userId') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Post(':id/submit-verification')
  submitForVerification(
    @Param('id') id: string,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.service.submitForVerification(id, dto);
  }

  @Post(':id/verify')
  verifyPlan(
    @Param('id') id: string,
    @Body() dto: VerifyTreatmentPlanDto,
  ) {
    return this.service.verifyPlan(id, dto);
  }

  @Post(':id/submit-review')
  submitForReview(
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.service.submitForReview(id, dto);
  }

  @Post(':id/review')
  reviewPlan(
    @Param('id') id: string,
    @Body() dto: ReviewTreatmentPlanDto,
  ) {
    return this.service.reviewPlan(id, dto);
  }

  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @Body() dto: AddAttachmentDto,
  ) {
    return this.service.addAttachment(id, dto);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query('userId') userId: string,
  ) {
    return this.service.removeAttachment(id, attachmentId, userId);
  }

  @Post('batch/submit-verification')
  batchSubmitVerification(@Body() dto: BatchOperationDto) {
    return this.service.batchSubmitVerification(dto);
  }

  @Post('batch/verify')
  batchVerify(@Body() dto: BatchOperationDto & { result: 'pass' | 'reject' }) {
    return this.service.batchVerify(dto);
  }

  @Post('batch/review')
  batchReview(@Body() dto: BatchOperationDto & { result: 'pass' | 'reject' }) {
    return this.service.batchReview(dto);
  }
}
