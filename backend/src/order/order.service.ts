import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatus, OrderSource } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { User, UserRole } from '../entities/user.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';
import { Attachment } from '../entities/attachment.entity';
import { v4 as uuidv4 } from 'uuid';

export interface OrderItemDto {
  productId: string;
  productName?: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
}

export interface CreateOrderDto {
  communityName: string;
  contactName?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  remark?: string;
  expectedDeliveryDate?: Date;
  items: OrderItemDto[];
}

export interface UpdateOrderDto {
  communityName?: string;
  contactName?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  remark?: string;
  expectedDeliveryDate?: Date;
  items?: OrderItemDto[];
  rejectReason?: string;
  auditRemark?: string;
}

export interface OrderQueryParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  statuses?: OrderStatus[];
  source?: OrderSource;
  keyword?: string;
  communityName?: string;
  hasException?: boolean;
  createdById?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Attachment)
    private attachmentRepository: Repository<Attachment>,
    private auditLogService: AuditLogService,
  ) {}

  generateOrderNo(): string {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TG${dateStr}${random}`;
  }

  async create(dto: CreateOrderDto, user: User, source: OrderSource = OrderSource.ONLINE, importBatchId?: string): Promise<Order> {
    const orderNo = this.generateOrderNo();

    let totalAmount = 0;
    let totalQuantity = 0;

    const items: OrderItem[] = [];
    for (const itemDto of dto.items) {
      const product = await this.productRepository.findOne({ where: { id: itemDto.productId } });
      if (!product && source === OrderSource.ONLINE) {
        throw new BadRequestException(`商品不存在: ${itemDto.productId}`);
      }

      const effectivePrice = source === OrderSource.ONLINE && product
        ? (product.groupBuyPrice || product.price)
        : itemDto.unitPrice;

      const subtotal = effectivePrice * itemDto.quantity;
      totalAmount += subtotal;
      totalQuantity += itemDto.quantity;

      const orderItem = this.orderItemRepository.create({
        productId: itemDto.productId,
        productName: itemDto.productName || product?.name || '未知商品',
        unitPrice: effectivePrice,
        quantity: itemDto.quantity,
        unit: itemDto.unit || product?.unit,
        subtotal,
      });
      items.push(orderItem);
    }

    const order = this.orderRepository.create({
      orderNo,
      communityName: dto.communityName,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      deliveryAddress: dto.deliveryAddress,
      remark: dto.remark,
      expectedDeliveryDate: dto.expectedDeliveryDate,
      totalAmount,
      totalQuantity,
      status: OrderStatus.DRAFT,
      source,
      createdById: user.id,
      importBatchId,
      items,
    });

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: saved.id,
      userId: user.id,
      action: AuditAction.CREATE,
      description: `创建订单 ${orderNo}`,
      success: true,
      afterData: saved,
    });

    return saved;
  }

  async findAll(params: OrderQueryParams): Promise<{ data: Order[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params;
    const queryBuilder = this.orderRepository.createQueryBuilder('order');

    if (filters.status) {
      queryBuilder.andWhere('order.status = :status', { status: filters.status });
    }
    if (filters.statuses && filters.statuses.length > 0) {
      queryBuilder.andWhere('order.status IN (:...statuses)', { statuses: filters.statuses });
    }
    if (filters.source) {
      queryBuilder.andWhere('order.source = :source', { source: filters.source });
    }
    if (filters.keyword) {
      queryBuilder.andWhere('(order.orderNo LIKE :keyword OR order.communityName LIKE :keyword)', {
        keyword: `%${filters.keyword}%`,
      });
    }
    if (filters.communityName) {
      queryBuilder.andWhere('order.communityName LIKE :communityName', {
        communityName: `%${filters.communityName}%`,
      });
    }
    if (filters.createdById) {
      queryBuilder.andWhere('order.createdById = :createdById', { createdById: filters.createdById });
    }
    if (filters.hasException) {
      queryBuilder.andWhere('order.status IN (:...exceptionStatuses)', {
        exceptionStatuses: [OrderStatus.EXCEPTION, OrderStatus.MATERIALS_MISSING, OrderStatus.TIMEOUT, OrderStatus.RETURNED],
      });
    }
    if (filters.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: filters.endDate });
    }

    queryBuilder
      .leftJoinAndSelect('order.createdBy', 'createdBy')
      .leftJoinAndSelect('order.reviewedBy', 'reviewedBy')
      .leftJoinAndSelect('order.finalReviewedBy', 'finalReviewedBy')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'attachments', 'createdBy', 'reviewedBy', 'finalReviewedBy'],
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  async findByOrderNo(orderNo: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { orderNo },
      relations: ['items'],
    });
  }

  async update(id: string, dto: UpdateOrderDto, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.REVIEW_REJECTED && order.status !== OrderStatus.FINAL_REJECTED) {
      if (user.role === UserRole.REGISTRAR) {
        throw new ForbiddenException('当前状态下无法编辑订单，请联系审核人员');
      }
    }

    if (dto.communityName !== undefined) order.communityName = dto.communityName;
    if (dto.contactName !== undefined) order.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) order.contactPhone = dto.contactPhone;
    if (dto.deliveryAddress !== undefined) order.deliveryAddress = dto.deliveryAddress;
    if (dto.remark !== undefined) order.remark = dto.remark;
    if (dto.expectedDeliveryDate !== undefined) order.expectedDeliveryDate = dto.expectedDeliveryDate;
    if (dto.rejectReason !== undefined) order.rejectReason = dto.rejectReason;
    if (dto.auditRemark !== undefined) order.auditRemark = dto.auditRemark;

    if (dto.items && dto.items.length > 0) {
      await this.orderItemRepository.delete({ orderId: id });

      let totalAmount = 0;
      let totalQuantity = 0;
      const items: OrderItem[] = [];

      for (const itemDto of dto.items) {
        const product = await this.productRepository.findOne({ where: { id: itemDto.productId } });
        const effectivePrice = product
          ? (product.groupBuyPrice || product.price)
          : itemDto.unitPrice;
        const subtotal = effectivePrice * itemDto.quantity;
        totalAmount += subtotal;
        totalQuantity += itemDto.quantity;

        const orderItem = this.orderItemRepository.create({
          orderId: id,
          productId: itemDto.productId,
          productName: itemDto.productName || product?.name || '未知商品',
          unitPrice: effectivePrice,
          quantity: itemDto.quantity,
          unit: itemDto.unit || product?.unit,
          subtotal,
        });
        items.push(orderItem);
      }

      await this.orderItemRepository.save(items);
      order.totalAmount = totalAmount;
      order.totalQuantity = totalQuantity;
    }

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.UPDATE,
      description: `更新订单 ${order.orderNo}`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async submitForReview(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.REVIEW_REJECTED && order.status !== OrderStatus.FINAL_REJECTED) {
      throw new BadRequestException('当前状态无法提交审核');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('订单商品不能为空');
    }

    order.status = OrderStatus.PENDING_REVIEW;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.SUBMIT,
      description: `提交订单 ${order.orderNo} 审核`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async reviewApprove(id: string, user: User, auditRemark?: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.PENDING_REVIEW) {
      throw new BadRequestException('当前状态无法审核');
    }

    order.status = OrderStatus.REVIEW_APPROVED;
    order.reviewedById = user.id;
    order.reviewedAt = new Date();
    if (auditRemark) {
      order.auditRemark = auditRemark;
    }

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.REVIEW_APPROVE,
      description: `主管审核通过订单 ${order.orderNo}`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async reviewReject(id: string, user: User, rejectReason: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.PENDING_REVIEW) {
      throw new BadRequestException('当前状态无法审核');
    }

    if (!rejectReason || rejectReason.trim() === '') {
      throw new BadRequestException('退回原因不能为空');
    }

    order.status = OrderStatus.REVIEW_REJECTED;
    order.reviewedById = user.id;
    order.reviewedAt = new Date();
    order.rejectReason = rejectReason;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.REVIEW_REJECT,
      description: `主管审核退回订单 ${order.orderNo}，原因：${rejectReason}`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async submitForFinalReview(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.REVIEW_APPROVED) {
      throw new BadRequestException('当前状态无法提交复核');
    }

    order.status = OrderStatus.PENDING_FINAL_REVIEW;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.SUBMIT,
      description: `提交订单 ${order.orderNo} 最终复核`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async finalApprove(id: string, user: User, auditRemark?: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.PENDING_FINAL_REVIEW) {
      throw new BadRequestException('当前状态无法复核');
    }

    order.status = OrderStatus.FINAL_APPROVED;
    order.finalReviewedById = user.id;
    order.finalReviewedAt = new Date();
    if (auditRemark) {
      order.auditRemark = auditRemark;
    }

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.FINAL_APPROVE,
      description: `复核通过订单 ${order.orderNo}，已归档`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async finalReject(id: string, user: User, rejectReason: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.PENDING_FINAL_REVIEW) {
      throw new BadRequestException('当前状态无法复核');
    }

    if (!rejectReason || rejectReason.trim() === '') {
      throw new BadRequestException('退回原因不能为空');
    }

    order.status = OrderStatus.FINAL_REJECTED;
    order.finalReviewedById = user.id;
    order.finalReviewedAt = new Date();
    order.rejectReason = rejectReason;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.FINAL_REJECT,
      description: `复核退回订单 ${order.orderNo}，原因：${rejectReason}`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async ship(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.FINAL_APPROVED) {
      throw new BadRequestException('当前状态无法发货');
    }

    order.status = OrderStatus.SHIPPED;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.SHIP,
      description: `订单 ${order.orderNo} 已发货`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async deliver(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('当前状态无法配送');
    }

    order.status = OrderStatus.DELIVERED;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.DELIVER,
      description: `订单 ${order.orderNo} 已配送`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async sign(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('当前状态无法签收');
    }

    order.status = OrderStatus.SIGNED;
    order.signedAt = new Date();

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.SIGN,
      description: `订单 ${order.orderNo} 已签收`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async archive(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (order.status !== OrderStatus.SIGNED) {
      throw new BadRequestException('当前状态无法归档');
    }

    order.status = OrderStatus.ARCHIVED;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.ARCHIVE,
      description: `订单 ${order.orderNo} 已归档`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async markException(id: string, user: User, reason: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    order.status = OrderStatus.EXCEPTION;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.EXCEPTION,
      description: `订单 ${order.orderNo} 标记为异常，原因：${reason}`,
      success: true,
      failReason: reason,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async markMaterialsMissing(id: string, user: User, reason: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    order.status = OrderStatus.MATERIALS_MISSING;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.EXCEPTION,
      description: `订单 ${order.orderNo} 标记为材料缺失，原因：${reason}`,
      success: false,
      failReason: reason,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async markTimeout(id: string, user: User, reason: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    order.status = OrderStatus.TIMEOUT;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.EXCEPTION,
      description: `订单 ${order.orderNo} 标记为超时，原因：${reason}`,
      success: false,
      failReason: reason,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async returnOrder(id: string, user: User, reason: string): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (![OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.SIGNED].includes(order.status)) {
      throw new BadRequestException('当前状态无法退回');
    }

    order.status = OrderStatus.RETURNED;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.RETURN,
      description: `订单 ${order.orderNo} 已退回，原因：${reason}`,
      success: false,
      failReason: reason,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async rectify(id: string, user: User): Promise<Order> {
    const order = await this.findOne(id);
    const beforeData = JSON.parse(JSON.stringify(order));

    if (![OrderStatus.EXCEPTION, OrderStatus.MATERIALS_MISSING, OrderStatus.TIMEOUT].includes(order.status)) {
      throw new BadRequestException('当前状态无法补正');
    }

    order.status = OrderStatus.DRAFT;

    const saved = await this.orderRepository.save(order);

    await this.auditLogService.create({
      orderId: id,
      userId: user.id,
      action: AuditAction.RECTIFY,
      description: `订单 ${order.orderNo} 已补正，重新进入草稿状态`,
      success: true,
      beforeData,
      afterData: saved,
    });

    return saved;
  }

  async batchProcess(
    ids: string[],
    action: string,
    user: User,
    reason?: string,
  ): Promise<{
    successCount: number;
    failedCount: number;
    results: {
      id: string;
      orderNo: string;
      success: boolean;
      reason?: string;
    }[];
  }> {
    const results: {
      id: string;
      orderNo: string;
      success: boolean;
      reason?: string;
    }[] = [];

    for (const id of ids) {
      let orderNo = '';
      try {
        const order = await this.orderRepository.findOne({ where: { id } });
        orderNo = order?.orderNo || id;

        if (!order) {
          throw new NotFoundException('订单不存在');
        }

        switch (action) {
          case 'submit':
            await this.submitForReview(id, user);
            break;
          case 'review_approve':
            await this.reviewApprove(id, user, reason);
            break;
          case 'review_reject':
            if (!reason) throw new BadRequestException('退回原因不能为空');
            await this.reviewReject(id, user, reason);
            break;
          case 'submit_final':
            await this.submitForFinalReview(id, user);
            break;
          case 'final_approve':
            await this.finalApprove(id, user, reason);
            break;
          case 'final_reject':
            if (!reason) throw new BadRequestException('退回原因不能为空');
            await this.finalReject(id, user, reason);
            break;
          case 'ship':
            await this.ship(id, user);
            break;
          case 'deliver':
            await this.deliver(id, user);
            break;
          case 'sign':
            await this.sign(id, user);
            break;
          case 'archive':
            await this.archive(id, user);
            break;
          case 'exception':
            if (!reason) throw new BadRequestException('异常原因不能为空');
            await this.markException(id, user, reason);
            break;
          case 'materials_missing':
            if (!reason) throw new BadRequestException('缺失材料说明不能为空');
            await this.markMaterialsMissing(id, user, reason);
            break;
          case 'timeout':
            if (!reason) throw new BadRequestException('超时原因不能为空');
            await this.markTimeout(id, user, reason);
            break;
          case 'return':
            if (!reason) throw new BadRequestException('退回原因不能为空');
            await this.returnOrder(id, user, reason);
            break;
          case 'rectify':
            await this.rectify(id, user);
            break;
          default:
            throw new BadRequestException(`不支持的操作: ${action}`);
        }
        results.push({ id, orderNo, success: true });
      } catch (error: any) {
        results.push({ id, orderNo: orderNo || id, success: false, reason: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return { successCount, failedCount, results };
  }

  async getAttachments(orderId: string): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async addAttachment(
    orderId: string,
    fileData: { filename: string; originalName: string; mimeType?: string; size?: number },
    type: string,
    user: User,
  ): Promise<Attachment> {
    const order = await this.findOne(orderId);

    const attachment = this.attachmentRepository.create({
      orderId,
      filename: fileData.filename,
      originalName: fileData.originalName,
      mimeType: fileData.mimeType,
      size: fileData.size,
      type: type as any,
      uploadedById: user.id,
    });

    const saved = await this.attachmentRepository.save(attachment);

    await this.auditLogService.create({
      orderId,
      userId: user.id,
      action: AuditAction.UPDATE,
      description: `上传附件：${fileData.originalName}`,
      success: true,
    });

    return saved;
  }

  async getStatistics(): Promise<any> {
    const allOrders = await this.orderRepository.find();

    const stats: Record<string, number> = {};
    Object.values(OrderStatus).forEach(status => {
      stats[status] = 0;
    });

    allOrders.forEach(order => {
      stats[order.status] = (stats[order.status] || 0) + 1;
    });

    return {
      total: allOrders.length,
      byStatus: stats,
    };
  }
}
