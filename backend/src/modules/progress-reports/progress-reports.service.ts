import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as dayjs from 'dayjs';
import { ProgressReport } from './entities/progress-report.entity';
import { CreateProgressReportDto } from './dto/create-progress-report.dto';
import { UpdateProgressReportDto } from './dto/update-progress-report.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { ReviewDto } from './dto/review.dto';
import { VerifyDto } from './dto/verify.dto';
import { CorrectDto } from './dto/correct.dto';
import { HandleTimeoutDto } from './dto/handle-timeout.dto';
import { ProgressStatus } from '../../common/enums/progress-status.enum';
import { TimeoutStatus } from '../../common/enums/timeout-status.enum';
import { OperationType } from '../../common/enums/operation-type.enum';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';

@Injectable()
export class ProgressReportsService {
  constructor(
    @InjectRepository(ProgressReport)
    private progressReportsRepository: Repository<ProgressReport>,
    private operationLogsService: OperationLogsService,
  ) {}

  private calculateTimeoutStatus(report: ProgressReport): TimeoutStatus {
    const now = dayjs();
    const deadline = dayjs(report.deadline);
    const daysDiff = deadline.diff(now, 'day');

    if (daysDiff < 0) {
      return TimeoutStatus.OVERDUE;
    } else if (daysDiff <= 2) {
      return TimeoutStatus.WARNING;
    }
    return TimeoutStatus.NORMAL;
  }

  private updateTimeoutInfo(report: ProgressReport): void {
    const now = dayjs();
    const deadline = dayjs(report.deadline);
    report.timeoutStatus = this.calculateTimeoutStatus(report);
    report.timeoutDays = Math.max(0, now.diff(deadline, 'day'));
  }

  async create(
    createProgressReportDto: CreateProgressReportDto,
    user: User,
  ): Promise<ProgressReport> {
    const report = this.progressReportsRepository.create({
      ...createProgressReportDto,
      deadline: new Date(createProgressReportDto.deadline),
      reportDate: createProgressReportDto.reportDate
        ? new Date(createProgressReportDto.reportDate)
        : null,
      responsiblePersonId: createProgressReportDto.responsiblePersonId || user.id,
      currentNodeEnteredAt: new Date(),
      status: ProgressStatus.DRAFT,
    });

    this.updateTimeoutInfo(report);
    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.CREATE,
      `创建进度报告: ${saved.title}`,
    );

    return this.findOne(saved.id);
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
    status?: ProgressStatus;
    timeoutStatus?: TimeoutStatus;
    keyword?: string;
    responsiblePersonId?: string;
    startDate?: string;
    endDate?: string;
    user?: User;
  }): Promise<{ list: ProgressReport[]; total: number }> {
    const {
      page = 1,
      pageSize = 20,
      status,
      timeoutStatus,
      keyword,
      responsiblePersonId,
      startDate,
      endDate,
      user,
    } = params || {};

    const query = this.progressReportsRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.responsiblePerson', 'responsiblePerson')
      .orderBy('report.createdAt', 'DESC');

    if (user && user.role === Role.REGISTRAR) {
      query.andWhere('report.responsiblePersonId = :userId', { userId: user.id });
    }

    if (status) {
      query.andWhere('report.status = :status', { status });
    }
    if (timeoutStatus) {
      query.andWhere('report.timeoutStatus = :timeoutStatus', { timeoutStatus });
    }
    if (keyword) {
      query.andWhere(
        '(report.title LIKE :keyword OR report.projectName LIKE :keyword OR report.content LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }
    if (responsiblePersonId) {
      query.andWhere('report.responsiblePersonId = :responsiblePersonId', {
        responsiblePersonId,
      });
    }
    if (startDate && endDate) {
      query.andWhere('report.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }

    const total = await query.getCount();
    const list = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    list.forEach((report) => this.updateTimeoutInfo(report));
    await this.progressReportsRepository.save(list);

    return { list, total };
  }

  async findOne(id: string): Promise<ProgressReport> {
    const report = await this.progressReportsRepository.findOne({
      where: { id },
      relations: [
        'responsiblePerson',
        'weeklyReports',
        'deviationAnalyses',
        'ownerReports',
        'operationLogs',
        'operationLogs.operator',
      ],
    });
    if (!report) {
      throw new NotFoundException('进度报告不存在');
    }
    this.updateTimeoutInfo(report);
    await this.progressReportsRepository.save(report);
    return report;
  }

  async update(
    id: string,
    updateProgressReportDto: UpdateProgressReportDto,
    user: User,
  ): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role === Role.REGISTRAR && report.responsiblePersonId !== user.id) {
      throw new ForbiddenException('只能修改自己负责的进度报告');
    }

    if (
      ![ProgressStatus.DRAFT, ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
        report.status,
      )
    ) {
      throw new BadRequestException('当前状态不允许修改');
    }

    Object.assign(report, {
      ...updateProgressReportDto,
      deadline: updateProgressReportDto.deadline
        ? new Date(updateProgressReportDto.deadline)
        : report.deadline,
      reportDate: updateProgressReportDto.reportDate
        ? new Date(updateProgressReportDto.reportDate)
        : report.reportDate,
    });

    this.updateTimeoutInfo(report);
    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.UPDATE,
      `更新进度报告信息`,
    );

    return this.findOne(saved.id);
  }

  async submitForReview(
    id: string,
    submitReviewDto: SubmitReviewDto,
    user: User,
  ): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role === Role.REGISTRAR && report.responsiblePersonId !== user.id) {
      throw new ForbiddenException('只能提交自己负责的进度报告');
    }

    if (![ProgressStatus.DRAFT, ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(report.status)) {
      throw new BadRequestException('当前状态不允许提交审核');
    }

    const fromStatus = report.status;
    report.status = ProgressStatus.PENDING_REVIEW;
    report.currentNodeEnteredAt = new Date();
    report.lastProcessResult = `已提交审核${submitReviewDto.remarks ? `，备注：${submitReviewDto.remarks}` : ''}`;
    this.updateTimeoutInfo(report);

    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.SUBMIT,
      report.lastProcessResult,
      submitReviewDto.remarks,
      fromStatus,
      ProgressStatus.PENDING_REVIEW,
    );

    return this.findOne(saved.id);
  }

  async startReview(id: string, user: User): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('只有进度审核主管可以执行审核操作');
    }

    if (report.status !== ProgressStatus.PENDING_REVIEW) {
      throw new BadRequestException('当前状态不允许开始审核');
    }

    const fromStatus = report.status;
    report.status = ProgressStatus.UNDER_REVIEW;
    report.lastProcessResult = `审核中，处理人：${user.name}`;
    this.updateTimeoutInfo(report);

    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.REVIEW,
      report.lastProcessResult,
      undefined,
      fromStatus,
      ProgressStatus.UNDER_REVIEW,
    );

    return this.findOne(saved.id);
  }

  async review(id: string, reviewDto: ReviewDto, user: User): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('只有进度审核主管可以执行审核操作');
    }

    if (report.status !== ProgressStatus.UNDER_REVIEW && report.status !== ProgressStatus.PENDING_REVIEW) {
      throw new BadRequestException('当前状态不允许审核');
    }

    const fromStatus = report.status;
    report.reviewCount += 1;

    if (reviewDto.approved) {
      report.status = ProgressStatus.PENDING_VERIFICATION;
      report.lastProcessResult = `审核通过，意见：${reviewDto.opinion}`;
      const saved = await this.progressReportsRepository.save(report);

      await this.operationLogsService.create(
        saved.id,
        user,
        OperationType.REVIEW_APPROVE,
        report.lastProcessResult,
        reviewDto.opinion,
        fromStatus,
        ProgressStatus.PENDING_VERIFICATION,
      );
    } else {
      report.status = ProgressStatus.REVIEW_REJECTED;
      report.lastProcessResult = `审核驳回，意见：${reviewDto.opinion}`;
      const saved = await this.progressReportsRepository.save(report);

      await this.operationLogsService.create(
        saved.id,
        user,
        OperationType.REVIEW_REJECT,
        report.lastProcessResult,
        reviewDto.opinion,
        fromStatus,
        ProgressStatus.REVIEW_REJECTED,
      );
    }

    report.currentNodeEnteredAt = new Date();
    this.updateTimeoutInfo(report);
    await this.progressReportsRepository.save(report);

    return this.findOne(report.id);
  }

  async startVerification(id: string, user: User): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以执行复核操作');
    }

    if (report.status !== ProgressStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('当前状态不允许开始复核');
    }

    const fromStatus = report.status;
    report.status = ProgressStatus.UNDER_VERIFICATION;
    report.lastProcessResult = `复核中，处理人：${user.name}`;
    this.updateTimeoutInfo(report);

    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.VERIFY,
      report.lastProcessResult,
      undefined,
      fromStatus,
      ProgressStatus.UNDER_VERIFICATION,
    );

    return this.findOne(saved.id);
  }

  async verify(id: string, verifyDto: VerifyDto, user: User): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以执行复核操作');
    }

    if (report.status !== ProgressStatus.UNDER_VERIFICATION && report.status !== ProgressStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('当前状态不允许复核');
    }

    const fromStatus = report.status;
    report.verificationCount += 1;

    if (verifyDto.approved) {
      report.status = ProgressStatus.ARCHIVED;
      report.lastProcessResult = `复核通过，已归档，意见：${verifyDto.opinion}`;
      const saved = await this.progressReportsRepository.save(report);

      await this.operationLogsService.create(
        saved.id,
        user,
        OperationType.VERIFY_APPROVE,
        report.lastProcessResult,
        verifyDto.opinion,
        fromStatus,
        ProgressStatus.ARCHIVED,
      );

      await this.operationLogsService.create(
        saved.id,
        user,
        OperationType.ARCHIVE,
        '进度报告已归档',
      );
    } else {
      report.status = ProgressStatus.VERIFICATION_REJECTED;
      report.lastProcessResult = `复核驳回，意见：${verifyDto.opinion}`;
      const saved = await this.progressReportsRepository.save(report);

      await this.operationLogsService.create(
        saved.id,
        user,
        OperationType.VERIFY_REJECT,
        report.lastProcessResult,
        verifyDto.opinion,
        fromStatus,
        ProgressStatus.VERIFICATION_REJECTED,
      );
    }

    report.currentNodeEnteredAt = new Date();
    this.updateTimeoutInfo(report);
    await this.progressReportsRepository.save(report);

    return this.findOne(report.id);
  }

  async correct(id: string, correctDto: CorrectDto, user: User): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (user.role === Role.REGISTRAR && report.responsiblePersonId !== user.id) {
      throw new ForbiddenException('只能补正自己负责的进度报告');
    }

    if (![ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(report.status)) {
      throw new BadRequestException('当前状态不允许补正');
    }

    Object.assign(report, {
      title: correctDto.title || report.title,
      content: correctDto.content || report.content,
      abnormalReason: correctDto.abnormalReason || report.abnormalReason,
      lastProcessResult: `已补正，说明：${correctDto.correctionRemark}`,
    });

    this.updateTimeoutInfo(report);
    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.CORRECT,
      report.lastProcessResult,
      correctDto.correctionRemark,
    );

    return this.findOne(saved.id);
  }

  async handleTimeout(
    id: string,
    handleTimeoutDto: HandleTimeoutDto,
    user: User,
  ): Promise<ProgressReport> {
    const report = await this.findOne(id);

    if (report.timeoutStatus !== TimeoutStatus.OVERDUE) {
      throw new BadRequestException('当前报告未超时，无需处理');
    }

    if (
      user.role === Role.REGISTRAR &&
      report.responsiblePersonId !== user.id
    ) {
      throw new ForbiddenException('只能处理自己负责的进度报告超时问题');
    }

    report.timeoutReason = handleTimeoutDto.timeoutReason;
    report.timeoutFollowUp = handleTimeoutDto.timeoutFollowUp;
    report.timeoutHandledAt = new Date();
    report.lastProcessResult = `超时已处理，原因：${handleTimeoutDto.timeoutReason}，后续措施：${handleTimeoutDto.timeoutFollowUp}`;

    const saved = await this.progressReportsRepository.save(report);

    await this.operationLogsService.create(
      saved.id,
      user,
      OperationType.TIMEOUT_HANDLE,
      report.lastProcessResult,
      handleTimeoutDto.remarks,
    );

    return this.findOne(saved.id);
  }

  async remove(id: string, user: User): Promise<void> {
    const report = await this.findOne(id);

    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以删除进度报告');
    }

    if (![ProgressStatus.DRAFT, ProgressStatus.ARCHIVED].includes(report.status)) {
      throw new BadRequestException('只能删除草稿或已归档的进度报告');
    }

    await this.operationLogsService.create(
      id,
      user,
      OperationType.DELETE,
      `删除进度报告: ${report.title}`,
    );

    await this.progressReportsRepository.remove(report);
  }

  async updateStatusByRelatedModule(
    progressReportId: string,
    operationType: OperationType,
    detail: string,
    user: User,
  ): Promise<void> {
    const report = await this.findOne(progressReportId);
    report.lastProcessResult = detail;

    await this.progressReportsRepository.save(report);
    await this.operationLogsService.create(
      progressReportId,
      user,
      operationType,
      detail,
    );
  }

  async getStatistics(user?: User): Promise<any> {
    const baseQuery = this.progressReportsRepository.createQueryBuilder('report');

    if (user && user.role === Role.REGISTRAR) {
      baseQuery.andWhere('report.responsiblePersonId = :userId', { userId: user.id });
    }

    const totalCount = await baseQuery.getCount();

    const statusCounts = await this.progressReportsRepository
      .createQueryBuilder('report')
      .select('report.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where((qb) => {
        if (user && user.role === Role.REGISTRAR) {
          qb.where('report.responsiblePersonId = :userId', { userId: user.id });
        }
        return '1=1';
      })
      .groupBy('report.status')
      .getRawMany();

    const timeoutCounts = await this.progressReportsRepository
      .createQueryBuilder('report')
      .select('report.timeoutStatus', 'timeoutStatus')
      .addSelect('COUNT(*)', 'count')
      .where((qb) => {
        if (user && user.role === Role.REGISTRAR) {
          qb.where('report.responsiblePersonId = :userId', { userId: user.id });
        }
        return '1=1';
      })
      .groupBy('report.timeoutStatus')
      .getRawMany();

    const overdueCount = timeoutCounts.find(
      (item) => item.timeoutStatus === TimeoutStatus.OVERDUE,
    )?.count || 0;

    const thisMonthStart = dayjs().startOf('month').toDate();
    const thisMonthEnd = dayjs().endOf('month').toDate();

    const monthQuery = this.progressReportsRepository.createQueryBuilder('report');
    if (user && user.role === Role.REGISTRAR) {
      monthQuery.andWhere('report.responsiblePersonId = :userId', { userId: user.id });
    }
    const thisMonthCount = await monthQuery
      .andWhere({ createdAt: Between(thisMonthStart, thisMonthEnd) })
      .getCount();

    return {
      totalCount,
      thisMonthCount,
      overdueCount: Number(overdueCount),
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = Number(item.count);
        return acc;
      }, {}),
      timeoutCounts: timeoutCounts.reduce((acc, item) => {
        acc[item.timeoutStatus] = Number(item.count);
        return acc;
      }, {}),
    };
  }
}
