import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

export interface CreateAuditLogDto {
  orderId?: string;
  userId?: string;
  action: AuditAction;
  description?: string;
  beforeData?: any;
  afterData?: any;
  failReason?: string;
  success?: boolean;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      ...dto,
      success: dto.success ?? true,
    });
    return this.auditLogRepository.save(log);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    orderId?: string;
    userId?: string;
    action?: AuditAction;
    success?: boolean;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params;
    const queryBuilder = this.auditLogRepository.createQueryBuilder('log');

    if (filters.orderId) {
      queryBuilder.andWhere('log.orderId = :orderId', { orderId: filters.orderId });
    }
    if (filters.userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters.action) {
      queryBuilder.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.success !== undefined) {
      queryBuilder.andWhere('log.success = :success', { success: filters.success });
    }

    queryBuilder
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<AuditLog> {
    return this.auditLogRepository.findOne({
      where: { id },
      relations: ['user', 'order'],
    });
  }

  async getOrderAuditLogs(orderId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { orderId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
