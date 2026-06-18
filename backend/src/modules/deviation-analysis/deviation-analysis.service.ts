import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviationAnalysis } from './entities/deviation-analysis.entity';
import { ProgressReportsService } from '../progress-reports/progress-reports.service';
import { OperationType } from '../../common/enums/operation-type.enum';
import { Role } from '../../common/enums/role.enum';
import { ProgressStatus } from '../../common/enums/progress-status.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DeviationAnalysisService {
  constructor(
    @InjectRepository(DeviationAnalysis)
    private deviationAnalysisRepository: Repository<DeviationAnalysis>,
    private progressReportsService: ProgressReportsService,
  ) {}

  async create(data: any, user: User): Promise<DeviationAnalysis> {
    if (user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('只有进度审核主管可以创建偏差分析');
    }

    const progressReport = await this.progressReportsService.findOne(data.progressReportId);
    if (
      ![
        ProgressStatus.UNDER_REVIEW,
        ProgressStatus.UNDER_VERIFICATION,
        ProgressStatus.PENDING_REVIEW,
        ProgressStatus.PENDING_VERIFICATION,
      ].includes(progressReport.status as ProgressStatus)
    ) {
      throw new BadRequestException(
        `当前状态（${progressReport.status}）不允许创建偏差分析，请在审核中或复核中阶段创建`,
      );
    }

    const analysis = this.deviationAnalysisRepository.create(data);
    const saved = await this.deviationAnalysisRepository.save(analysis) as unknown as DeviationAnalysis;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.DEVIATION_CREATE,
      `新增偏差分析：${data.deviationDescription.substring(0, 30)}${data.deviationDescription.length > 30 ? '...' : ''}，偏差率 ${data.deviationPercentage}%`,
      user,
      `原因分析：${data.causeAnalysis || ''}；影响评估：${data.impactAssessment || ''}；整改措施：${data.correctionMeasures || ''}`,
    );

    return saved;
  }

  async findAll(progressReportId?: string): Promise<DeviationAnalysis[]> {
    const query = this.deviationAnalysisRepository.createQueryBuilder('deviation').orderBy('deviation.createdAt', 'DESC');
    if (progressReportId) {
      query.andWhere('deviation.progressReportId = :progressReportId', { progressReportId });
    }
    return query.getMany();
  }

  async findOne(id: string): Promise<DeviationAnalysis> {
    const analysis = await this.deviationAnalysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException('偏差分析不存在');
    }
    return analysis;
  }

  async approve(id: string, opinion: string, user: User): Promise<DeviationAnalysis> {
    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以审批偏差分析');
    }

    const analysis = await this.findOne(id);
    if (analysis.isApproved) {
      throw new BadRequestException('该偏差分析已审批');
    }

    const progressReport = await this.progressReportsService.findOne(analysis.progressReportId);
    if (
      ![ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
        progressReport.status as ProgressStatus,
      )
    ) {
      throw new BadRequestException(
        `当前状态（${progressReport.status}）不允许审批偏差分析，请在审核驳回或复核驳回状态下审批`,
      );
    }

    analysis.isApproved = true;
    analysis.approvalOpinion = opinion;
    const saved = await this.deviationAnalysisRepository.save(analysis) as unknown as DeviationAnalysis;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.DEVIATION_APPROVE,
      `偏差分析已审批通过，意见：${opinion}`,
      user,
      `偏差描述：${saved.deviationDescription.substring(0, 50)}；整改措施：${saved.correctionMeasures || ''}`,
    );

    return saved;
  }

  async update(id: string, data: any, user: User): Promise<DeviationAnalysis> {
    if (user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('只有进度审核主管可以修改偏差分析');
    }

    const analysis = await this.findOne(id);
    if (analysis.isApproved) {
      throw new BadRequestException('已审批的偏差分析不能修改');
    }

    const progressReport = await this.progressReportsService.findOne(analysis.progressReportId);
    if (progressReport.status === ProgressStatus.ARCHIVED) {
      throw new BadRequestException('已归档的进度报告不能修改偏差分析');
    }

    Object.assign(analysis, data);
    const saved = await this.deviationAnalysisRepository.save(analysis) as unknown as DeviationAnalysis;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.DEVIATION_UPDATE,
      `更新偏差分析：${saved.deviationDescription.substring(0, 30)}${saved.deviationDescription.length > 30 ? '...' : ''}，偏差率 ${saved.deviationPercentage}%`,
      user,
      `原因分析：${saved.causeAnalysis || ''}；影响评估：${saved.impactAssessment || ''}；整改措施：${saved.correctionMeasures || ''}`,
    );

    return saved;
  }

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以删除偏差分析');
    }

    const analysis = await this.findOne(id);
    await this.deviationAnalysisRepository.remove(analysis);
  }
}
