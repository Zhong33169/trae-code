import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProgressReportsService } from './progress-reports.service';
import { CreateProgressReportDto } from './dto/create-progress-report.dto';
import { UpdateProgressReportDto } from './dto/update-progress-report.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { ReviewDto } from './dto/review.dto';
import { VerifyDto } from './dto/verify.dto';
import { CorrectDto } from './dto/correct.dto';
import { HandleTimeoutDto } from './dto/handle-timeout.dto';
import { ProgressStatus } from '../../common/enums/progress-status.enum';
import { TimeoutStatus } from '../../common/enums/timeout-status.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('progress-reports')
export class ProgressReportsController {
  constructor(
    private readonly progressReportsService: ProgressReportsService,
  ) {}

  @Post()
  @Roles(Role.REGISTRAR)
  create(
    @Body() createProgressReportDto: CreateProgressReportDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.create(createProgressReportDto, user);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: ProgressStatus,
    @Query('timeoutStatus') timeoutStatus?: TimeoutStatus,
    @Query('keyword') keyword?: string,
    @Query('responsiblePersonId') responsiblePersonId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: User,
  ) {
    return this.progressReportsService.findAll({
      page,
      pageSize,
      status,
      timeoutStatus,
      keyword,
      responsiblePersonId,
      startDate,
      endDate,
      user,
    });
  }

  @Get('statistics')
  getStatistics(@CurrentUser() user?: User) {
    return this.progressReportsService.getStatistics(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.progressReportsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.REGISTRAR)
  update(
    @Param('id') id: string,
    @Body() updateProgressReportDto: UpdateProgressReportDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.update(id, updateProgressReportDto, user);
  }

  @Post(':id/submit-review')
  @Roles(Role.REGISTRAR)
  submitForReview(
    @Param('id') id: string,
    @Body() submitReviewDto: SubmitReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.submitForReview(id, submitReviewDto, user);
  }

  @Post(':id/start-review')
  @Roles(Role.SUPERVISOR)
  startReview(@Param('id') id: string, @CurrentUser() user: User) {
    return this.progressReportsService.startReview(id, user);
  }

  @Post(':id/review')
  @Roles(Role.SUPERVISOR)
  review(
    @Param('id') id: string,
    @Body() reviewDto: ReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.review(id, reviewDto, user);
  }

  @Post(':id/start-verification')
  @Roles(Role.SUPERVISOR_ENGINEER)
  startVerification(@Param('id') id: string, @CurrentUser() user: User) {
    return this.progressReportsService.startVerification(id, user);
  }

  @Post(':id/verify')
  @Roles(Role.SUPERVISOR_ENGINEER)
  verify(
    @Param('id') id: string,
    @Body() verifyDto: VerifyDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.verify(id, verifyDto, user);
  }

  @Post(':id/correct')
  @Roles(Role.REGISTRAR)
  correct(
    @Param('id') id: string,
    @Body() correctDto: CorrectDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.correct(id, correctDto, user);
  }

  @Post(':id/handle-timeout')
  handleTimeout(
    @Param('id') id: string,
    @Body() handleTimeoutDto: HandleTimeoutDto,
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.handleTimeout(id, handleTimeoutDto, user);
  }

  @Post('batch/process')
  batchProcess(
    @Body() body: { ids: string[]; action: string; data: any },
    @CurrentUser() user: User,
  ) {
    return this.progressReportsService.batchProcess(body.ids, body.action, body.data, user);
  }

  @Delete(':id')
  @Roles(Role.SUPERVISOR_ENGINEER)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.progressReportsService.remove(id, user);
  }
}
