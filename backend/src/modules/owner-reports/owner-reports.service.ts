import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnerReport } from './entities/owner-report.entity';
import { ProgressReportsService } from '../progress-reports/progress-reports.service';
import { OperationType } from '../../common/enums/operation-type.enum';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OwnerReportsService {
  constructor(
    @InjectRepository(OwnerReport)
    private ownerReportsRepository: Repository<OwnerReport>,
    private progressReportsService: ProgressReportsService,
  ) {}

  async create(data: any, user: User): Promise<OwnerReport> {
    if (user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('只有进度审核主管可以创建业主汇报');
    }

    const report = this.ownerReportsRepository.create({
      ...data,
      reportDate: new Date(data.reportDate),
    });
    const saved = await this.ownerReportsRepository.save(report) as unknown as OwnerReport;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.OWNER_REPORT_CREATE,
      `新增业主汇报：${data.reportTitle}`,
      user,
      `汇报内容：${data.reportContent ? data.reportContent.substring(0, 50) : ''}`,
    );

    return saved;
  }

  async findAll(progressReportId?: string): Promise<OwnerReport[]> {
    const query = this.ownerReportsRepository.createQueryBuilder('owner').orderBy('owner.reportDate', 'DESC');
    if (progressReportId) {
      query.andWhere('owner.progressReportId = :progressReportId', { progressReportId });
    }
    return query.getMany();
  }

  async findOne(id: string): Promise<OwnerReport> {
    const report = await this.ownerReportsRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('业主汇报不存在');
    }
    return report;
  }

  async acknowledge(id: string, feedback: string, user: User): Promise<OwnerReport> {
    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以确认业主汇报');
    }

    const report = await this.findOne(id);
    if (report.ownerAcknowledged) {
      throw new BadRequestException('该业主汇报已确认');
    }

    report.ownerAcknowledged = true;
    report.ownerFeedback = feedback;
    const saved = await this.ownerReportsRepository.save(report) as unknown as OwnerReport;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.OWNER_REPORT_ACKNOWLEDGE,
      `业主汇报已确认，反馈：${feedback}`,
      user,
      `汇报标题：${saved.reportTitle}`,
    );

    return saved;
  }

  async update(id: string, data: any, user: User): Promise<OwnerReport> {
    if (user.role !== Role.SUPERVISOR) {
      throw new ForbiddenException('只有进度审核主管可以修改业主汇报');
    }

    const report = await this.findOne(id);
    if (report.ownerAcknowledged) {
      throw new BadRequestException('已确认的业主汇报不能修改');
    }

    Object.assign(report, {
      ...data,
      reportDate: data.reportDate ? new Date(data.reportDate) : report.reportDate,
    });
    const saved = await this.ownerReportsRepository.save(report) as unknown as OwnerReport;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.OWNER_REPORT_UPDATE,
      `更新业主汇报：${saved.reportTitle}`,
      user,
      `汇报内容：${saved.reportContent ? saved.reportContent.substring(0, 50) : ''}`,
    );

    return saved;
  }

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以删除业主汇报');
    }

    const report = await this.findOne(id);
    await this.ownerReportsRepository.remove(report);
  }
}
