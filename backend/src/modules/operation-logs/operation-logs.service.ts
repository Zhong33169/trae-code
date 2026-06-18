import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog } from './entities/operation-log.entity';
import { OperationType } from '../../common/enums/operation-type.enum';
import { ProgressStatus } from '../../common/enums/progress-status.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OperationLogsService {
  constructor(
    @InjectRepository(OperationLog)
    private operationLogsRepository: Repository<OperationLog>,
  ) {}

  async create(
    progressReportId: string,
    operator: User,
    operationType: OperationType,
    operationDetail?: string,
    remarks?: string,
    fromStatus?: ProgressStatus,
    toStatus?: ProgressStatus,
  ): Promise<OperationLog> {
    const log = this.operationLogsRepository.create({
      progressReportId,
      operatorId: operator.id,
      operationType,
      operationDetail,
      remarks,
      fromStatus,
      toStatus,
    });
    return this.operationLogsRepository.save(log);
  }

  async findByProgressReportId(progressReportId: string): Promise<OperationLog[]> {
    return this.operationLogsRepository.find({
      where: { progressReportId },
      relations: ['operator'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(params?: {
    page?: number;
    pageSize?: number;
    operatorId?: string;
    operationType?: OperationType;
    progressReportId?: string;
  }): Promise<{ list: OperationLog[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params || {};
    const query = this.operationLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.operator', 'operator')
      .leftJoinAndSelect('log.progressReport', 'progressReport')
      .orderBy('log.createdAt', 'DESC');

    if (filters.operatorId) {
      query.andWhere('log.operatorId = :operatorId', { operatorId: filters.operatorId });
    }
    if (filters.operationType) {
      query.andWhere('log.operationType = :operationType', { operationType: filters.operationType });
    }
    if (filters.progressReportId) {
      query.andWhere('log.progressReportId = :progressReportId', { progressReportId: filters.progressReportId });
    }

    const total = await query.getCount();
    const list = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total };
  }
}
