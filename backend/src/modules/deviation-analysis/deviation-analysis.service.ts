import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviationAnalysis } from './entities/deviation-analysis.entity';
import { ProgressReportsService } from '../progress-reports/progress-reports.service';
import { OperationType } from '../../common/enums/operation-type.enum';
import { Role } from '../../common/enums/role.enum';
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

    const analysis = this.deviationAnalysisRepository.create(data);
    const saved = await this.deviationAnalysisRepository.save(analysis) as unknown as DeviationAnalysis;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.DEVIATION_CREATE,
      `新增偏差分析：${data.deviationDescription.substring(0, 30)}${data.deviationDescription.length > 30 ? '...' : ''}，偏差率 ${data.deviationPercentage}%`,
      user,
      `原因分析：${data.causeAnalysis || ''}`,
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

    analysis.isApproved = true;
    analysis.approvalOpinion = opinion;
    const saved = await this.deviationAnalysisRepository.save(analysis) as unknown as DeviationAnalysis;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.DEVIATION_APPROVE,
      `偏差分析已审批通过，意见：${opinion}`,
      user,
      `偏差描述：${saved.deviationDescription.substring(0, 50)}`,
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

    Object.assign(analysis, data);
    const saved = await this.deviationAnalysisRepository.save(analysis) as unknown as DeviationAnalysis;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.DEVIATION_UPDATE,
      `更新偏差分析：${saved.deviationDescription.substring(0, 30)}${saved.deviationDescription.length > 30 ? '...' : ''}`,
      user,
      `原因分析：${saved.causeAnalysis || ''}`,
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
