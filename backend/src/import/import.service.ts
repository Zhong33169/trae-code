import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ImportBatch, ImportBatchStatus, ImportSource } from '../entities/import-batch.entity';
import { ImportRecord, ImportRecordStatus } from '../entities/import-record.entity';
import { Order, OrderStatus, OrderSource } from '../entities/order.entity';
import { User, UserRole } from '../entities/user.entity';
import { OrderService } from '../order/order.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';
import { v4 as uuidv4 } from 'uuid';

export interface ImportRecordData {
  orderNo?: string;
  communityName: string;
  contactName?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  remark?: string;
  expectedDeliveryDate?: Date;
  items: {
    productName: string;
    unitPrice: number;
    quantity: number;
    unit?: string;
    productId?: string;
  }[];
  validationErrors?: string[];
}

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(ImportBatch)
    private importBatchRepository: Repository<ImportBatch>,
    @InjectRepository(ImportRecord)
    private importRecordRepository: Repository<ImportRecord>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private orderService: OrderService,
    private auditLogService: AuditLogService,
  ) {}

  generateBatchNo(): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `IMP${dateStr}${random}`;
  }

  parseExcelFile(filePath: string): ImportRecordData[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const records: ImportRecordData[] = [];

    jsonData.forEach((row: any, index: number) => {
      const validationErrors: string[] = [];
      const rowNumber = index + 2;

      const orderNo = row['订单编号'] || row['orderNo'] || '';
      const communityName = (row['社区名称'] || row['communityName'] || '').toString().trim();
      const productName = (row['商品名称'] || row['productName'] || '').toString().trim();
      const unitPriceStr = (row['单价'] || row['unitPrice'] || '0').toString();
      const unitPrice = parseFloat(unitPriceStr);
      const quantityStr = (row['数量'] || row['quantity'] || '0').toString();
      const quantity = parseInt(quantityStr, 10);
      const unit = (row['单位'] || row['unit'] || '件').toString().trim() || '件';

      if (!communityName) {
        validationErrors.push(`第${rowNumber}行：缺少社区名称`);
      }
      if (!productName) {
        validationErrors.push(`第${rowNumber}行：缺少商品名称`);
      }
      if (isNaN(quantity) || quantity <= 0) {
        validationErrors.push(`第${rowNumber}行：缺少商品数量或数量无效（${quantityStr}）`);
      }
      if (isNaN(unitPrice) || unitPrice < 0) {
        validationErrors.push(`第${rowNumber}行：单价无效（${unitPriceStr}）`);
      }

      records.push({
        orderNo: orderNo || undefined,
        communityName,
        contactName: (row['联系人'] || row['contactName'] || '').toString().trim() || undefined,
        contactPhone: (row['联系电话'] || row['contactPhone'] || '').toString().trim() || undefined,
        deliveryAddress: (row['配送地址'] || row['deliveryAddress'] || '').toString().trim() || undefined,
        remark: (row['备注'] || row['remark'] || '').toString().trim() || undefined,
        expectedDeliveryDate: row['预计配送日期'] || row['expectedDeliveryDate']
          ? new Date(row['预计配送日期'] || row['expectedDeliveryDate'])
          : undefined,
        items: [
          {
            productName,
            unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
            quantity: isNaN(quantity) ? 0 : quantity,
            unit,
          },
        ],
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      });
    });

    return records;
  }

  async createBatch(
    filename: string,
    source: ImportSource,
    user: User,
    recordsData: ImportRecordData[],
    remark?: string,
  ): Promise<ImportBatch> {
    const batchNo = this.generateBatchNo();

    const batch = this.importBatchRepository.create({
      batchNo,
      source,
      filename,
      totalRecords: recordsData.length,
      remark,
      importedById: user.id,
      status: ImportBatchStatus.PENDING,
      records: recordsData.map((data, index) =>
        this.importRecordRepository.create({
          rowNumber: index + 1,
          sourceOrderNo: data.orderNo,
          rawData: data,
          status: ImportRecordStatus.PENDING,
        }),
      ),
    });

    return this.importBatchRepository.save(batch);
  }

  async processBatch(batchId: string, user: User): Promise<ImportBatch> {
    const batch = await this.importBatchRepository.findOne({
      where: { id: batchId },
      relations: ['records'],
    });

    if (!batch) {
      throw new NotFoundException('导入批次不存在');
    }

    if (batch.status !== ImportBatchStatus.PENDING && batch.status !== ImportBatchStatus.PROCESSING) {
      throw new BadRequestException('该批次已处理过，不能重复处理');
    }

    batch.status = ImportBatchStatus.PROCESSING;
    await this.importBatchRepository.save(batch);

    let successCount = 0;
    let failedCount = 0;
    let conflictCount = 0;
    let skippedCount = 0;

    for (const record of batch.records) {
      try {
        const data = record.rawData as ImportRecordData;

        if (data.validationErrors && data.validationErrors.length > 0) {
          record.status = ImportRecordStatus.FAILED;
          record.failReason = data.validationErrors.join('；');
          failedCount++;
          await this.importRecordRepository.save(record);
          continue;
        }

        if (!data.communityName) {
          record.status = ImportRecordStatus.FAILED;
          record.failReason = '缺少社区名称';
          failedCount++;
          await this.importRecordRepository.save(record);
          continue;
        }

        if (!data.items || data.items.length === 0) {
          record.status = ImportRecordStatus.FAILED;
          record.failReason = '缺少商品信息';
          failedCount++;
          await this.importRecordRepository.save(record);
          continue;
        }

        const invalidItem = data.items.find(i => !i.productName || i.quantity <= 0);
        if (invalidItem) {
          const errs: string[] = [];
          if (!invalidItem.productName) errs.push('缺少商品名称');
          if (invalidItem.quantity <= 0) errs.push('商品数量无效');
          record.status = ImportRecordStatus.FAILED;
          record.failReason = errs.join('；');
          failedCount++;
          await this.importRecordRepository.save(record);
          continue;
        }

        const differences: any = {};
        let hasConflict = false;

        if (data.orderNo) {
          const existingOrder = await this.orderService.findByOrderNo(data.orderNo);

          if (existingOrder) {
            hasConflict = true;
            if (existingOrder.source === OrderSource.OFFLINE_IMPORT) {
              differences.conflictType = 'duplicate_import';
              differences.description = `订单 ${data.orderNo} 已通过离线导入存在（批次：${existingOrder.importBatchId || '未知'}，状态：${existingOrder.status}），重复导入不覆盖`;
              differences.existingOrderId = existingOrder.id;
              differences.existingStatus = existingOrder.status;
              differences.existingCreatedAt = existingOrder.createdAt;
              differences.importData = {
                communityName: data.communityName,
                items: data.items,
              };
              differences.existingData = {
                communityName: existingOrder.communityName,
                totalAmount: existingOrder.totalAmount,
                totalQuantity: existingOrder.totalQuantity,
              };
            } else {
              differences.conflictType = 'online_offline_conflict';
              differences.description = `订单 ${data.orderNo} 为线上订单（创建人：${existingOrder.createdById || '未知'}，状态：${existingOrder.status}），与线下台账状态可能冲突，不静默覆盖`;
              differences.existingOrderId = existingOrder.id;
              differences.existingStatus = existingOrder.status;
              differences.existingSource = existingOrder.source;
              differences.existingCreatedAt = existingOrder.createdAt;
              differences.importData = {
                communityName: data.communityName,
                items: data.items,
              };
              differences.existingData = {
                communityName: existingOrder.communityName,
                totalAmount: existingOrder.totalAmount,
                totalQuantity: existingOrder.totalQuantity,
              };
            }

            record.status = ImportRecordStatus.CONFLICT;
            record.conflictDescription = differences.description;
            record.differences = differences;
            conflictCount++;
            await this.importRecordRepository.save(record);

            await this.auditLogService.create({
              orderId: existingOrder.id,
              userId: user.id,
              action: AuditAction.IMPORT,
              description: `离线导入冲突：批次 ${batch.batchNo} 第${record.rowNumber}行，${differences.description}`,
              success: false,
              failReason: differences.description,
            });

            continue;
          }
        }

        const orderDto = {
          communityName: data.communityName,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          deliveryAddress: data.deliveryAddress,
          remark: data.remark,
          expectedDeliveryDate: data.expectedDeliveryDate,
          items: data.items.map(item => ({
            productId: item.productId || uuidv4(),
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            unit: item.unit,
          })),
        };

        const order = await this.orderService.create(
          orderDto,
          user,
          OrderSource.OFFLINE_IMPORT,
          batch.id,
        );

        if (data.orderNo) {
          order.orderNo = data.orderNo;
          await this.orderRepository.save(order);
        }

        record.orderId = order.id;
        record.status = ImportRecordStatus.SUCCESS;
        successCount++;
        await this.importRecordRepository.save(record);

        await this.auditLogService.create({
          orderId: order.id,
          userId: user.id,
          action: AuditAction.IMPORT,
          description: `通过批次 ${batch.batchNo} 第${record.rowNumber}行离线导入订单`,
          success: true,
          afterData: order,
        });
      } catch (error: any) {
        record.status = ImportRecordStatus.FAILED;
        record.failReason = error.message || '导入失败：系统异常';
        failedCount++;
        await this.importRecordRepository.save(record);
      }
    }

    batch.successCount = successCount;
    batch.failedCount = failedCount;
    batch.conflictCount = conflictCount;
    batch.skippedCount = skippedCount;

    if (failedCount > 0 && conflictCount > 0 && successCount > 0) {
      batch.status = ImportBatchStatus.PARTIAL_SUCCESS;
    } else if (successCount > 0 && (failedCount > 0 || conflictCount > 0)) {
      batch.status = ImportBatchStatus.PARTIAL_SUCCESS;
    } else if (failedCount > 0 || conflictCount > 0) {
      if (successCount === 0) {
        batch.status = ImportBatchStatus.FAILED;
      } else {
        batch.status = ImportBatchStatus.PARTIAL_SUCCESS;
      }
    } else {
      batch.status = ImportBatchStatus.SUCCESS;
    }

    const saved = await this.importBatchRepository.save(batch);

    await this.auditLogService.create({
      userId: user.id,
      action: AuditAction.IMPORT,
      description: `处理导入批次 ${batch.batchNo}，共 ${batch.totalRecords} 条，成功 ${successCount} 条，失败 ${failedCount} 条，冲突 ${conflictCount} 条`,
      success: true,
    });

    return saved;
  }

  async importFromExcel(
    file: { filename: string; originalName: string; path: string },
    user: User,
    source: ImportSource = ImportSource.EXCEL,
    remark?: string,
  ): Promise<ImportBatch> {
    const recordsData = this.parseExcelFile(file.path);

    if (recordsData.length === 0) {
      throw new BadRequestException('文件中没有有效数据');
    }

    const batch = await this.createBatch(file.originalName, source, user, recordsData, remark);

    return this.processBatch(batch.id, user);
  }

  async findAllBatches(params: {
    page?: number;
    pageSize?: number;
    status?: ImportBatchStatus;
    source?: ImportSource;
    keyword?: string;
  }): Promise<{ data: ImportBatch[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params;
    const queryBuilder = this.importBatchRepository.createQueryBuilder('batch');

    if (filters.status) {
      queryBuilder.andWhere('batch.status = :status', { status: filters.status });
    }
    if (filters.source) {
      queryBuilder.andWhere('batch.source = :source', { source: filters.source });
    }
    if (filters.keyword) {
      queryBuilder.andWhere('(batch.batchNo LIKE :keyword OR batch.filename LIKE :keyword)', {
        keyword: `%${filters.keyword}%`,
      });
    }

    queryBuilder
      .leftJoinAndSelect('batch.importedBy', 'importedBy')
      .orderBy('batch.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findBatch(id: string): Promise<ImportBatch> {
    const batch = await this.importBatchRepository.findOne({
      where: { id },
      relations: ['records', 'importedBy'],
    });
    if (!batch) {
      throw new NotFoundException('导入批次不存在');
    }
    return batch;
  }

  async findBatchRecords(batchId: string, params: {
    page?: number;
    pageSize?: number;
    status?: ImportRecordStatus;
  }): Promise<{ data: ImportRecord[]; total: number }> {
    const { page = 1, pageSize = 50, ...filters } = params;
    const queryBuilder = this.importRecordRepository.createQueryBuilder('record');

    queryBuilder.andWhere('record.batchId = :batchId', { batchId });

    if (filters.status) {
      queryBuilder.andWhere('record.status = :status', { status: filters.status });
    }

    queryBuilder
      .leftJoinAndSelect('record.order', 'order')
      .orderBy('record.rowNumber', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findRecord(id: string): Promise<ImportRecord> {
    const record = await this.importRecordRepository.findOne({
      where: { id },
      relations: ['batch', 'order'],
    });
    if (!record) {
      throw new NotFoundException('导入记录不存在');
    }
    return record;
  }

  async retryFailedRecord(recordId: string, user: User): Promise<ImportRecord> {
    const record = await this.findRecord(recordId);

    if (record.status !== ImportRecordStatus.FAILED && record.status !== ImportRecordStatus.CONFLICT) {
      throw new BadRequestException('只有失败或冲突的记录可以重试');
    }

    const batch = await this.importBatchRepository.findOne({ where: { id: record.batchId } });
    if (!batch) {
      throw new NotFoundException('关联批次不存在');
    }

    const data = record.rawData as ImportRecordData;
    const previousStatus = record.status;

    try {
      const orderDto = {
        communityName: data.communityName,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        deliveryAddress: data.deliveryAddress,
        remark: data.remark,
        expectedDeliveryDate: data.expectedDeliveryDate,
        items: data.items.map(item => ({
          productId: item.productId || uuidv4(),
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          unit: item.unit,
        })),
      };

      const order = await this.orderService.create(
        orderDto,
        user,
        OrderSource.OFFLINE_IMPORT,
        batch.id,
      );

      if (data.orderNo) {
        order.orderNo = data.orderNo;
        await this.orderRepository.save(order);
      }

      record.orderId = order.id;
      record.status = ImportRecordStatus.SUCCESS;
      record.failReason = null;
      record.conflictDescription = null;
      record.differences = null;

      const saved = await this.importRecordRepository.save(record);

      batch.successCount++;
      if (previousStatus === ImportRecordStatus.FAILED) {
        batch.failedCount--;
      } else if (previousStatus === ImportRecordStatus.CONFLICT) {
        batch.conflictCount--;
      }
      await this.importBatchRepository.save(batch);

      await this.auditLogService.create({
        orderId: order.id,
        userId: user.id,
        action: AuditAction.IMPORT,
        description: `重试导入记录成功（批次 ${batch.batchNo}，行 ${record.rowNumber}）`,
        success: true,
      });

      return saved;
    } catch (error: any) {
      record.status = ImportRecordStatus.FAILED;
      record.failReason = error.message || '重试导入失败';
      return this.importRecordRepository.save(record);
    }
  }

  async getStatistics(): Promise<any> {
    const batches = await this.importBatchRepository.find();

    const stats = {
      totalBatches: batches.length,
      totalRecords: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalConflict: 0,
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    batches.forEach(batch => {
      stats.totalRecords += batch.totalRecords;
      stats.totalSuccess += batch.successCount;
      stats.totalFailed += batch.failedCount;
      stats.totalConflict += batch.conflictCount;

      stats.byStatus[batch.status] = (stats.byStatus[batch.status] || 0) + 1;
      stats.bySource[batch.source] = (stats.bySource[batch.source] || 0) + 1;
    });

    return stats;
  }
}
