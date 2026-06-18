import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklyReport } from './entities/weekly-report.entity';
import { ProgressReportsService } from '../progress-reports/progress-reports.service';
import { OperationType } from '../../common/enums/operation-type.enum';
import { Role } from '../../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class WeeklyReportsService {
  constructor(
    @InjectRepository(WeeklyReport)
    private weeklyReportsRepository: Repository<WeeklyReport>,
    private progressReportsService: ProgressReportsService,
  ) {}

  async create(data: any, user: User): Promise<WeeklyReport> {
    if (user.role !== Role.REGISTRAR) {
      throw new ForbiddenException('只有进度登记员可以创建周报');
    }

    const report = this.weeklyReportsRepository.create({
      ...data,
      weekStartDate: new Date(data.weekStartDate),
      weekEndDate: new Date(data.weekEndDate),
    });
    const saved = await this.weeklyReportsRepository.save(report) as unknown as WeeklyReport;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.UPDATE,
      `新增周报（${data.weekStartDate} 至 ${data.weekEndDate}），完成率 ${data.completionRate}%`,
      user,
    );

    return saved;
  }

  async findAll(progressReportId?: string): Promise<WeeklyReport[]> {
    const query = this.weeklyReportsRepository.createQueryBuilder('weekly').orderBy('weekly.weekStartDate', 'DESC');
    if (progressReportId) {
      query.andWhere('weekly.progressReportId = :progressReportId', { progressReportId });
    }
    return query.getMany();
  }

  async findOne(id: string): Promise<WeeklyReport> {
    const report = await this.weeklyReportsRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('周报不存在');
    }
    return report;
  }

  async update(id: string, data: any, user: User): Promise<WeeklyReport> {
    if (user.role !== Role.REGISTRAR) {
      throw new ForbiddenException('只有进度登记员可以修改周报');
    }

    const report = await this.findOne(id);
    Object.assign(report, {
      ...data,
      weekStartDate: data.weekStartDate ? new Date(data.weekStartDate) : report.weekStartDate,
      weekEndDate: data.weekEndDate ? new Date(data.weekEndDate) : report.weekEndDate,
    });
    const saved = await this.weeklyReportsRepository.save(report) as unknown as WeeklyReport;

    await this.progressReportsService.updateStatusByRelatedModule(
      saved.progressReportId,
      OperationType.UPDATE,
      `更新周报（${saved.weekStartDate.toISOString().split('T')[0]} 至 ${saved.weekEndDate.toISOString().split('T')[0]}）`,
      user,
    );

    return saved;
  }

  async remove(id: string, user: User): Promise<void> {
    if (user.role !== Role.SUPERVISOR_ENGINEER) {
      throw new ForbiddenException('只有工程监理公司复核负责人可以删除周报');
    }

    const report = await this.findOne(id);
    await this.weeklyReportsRepository.remove(report);
  }
}
