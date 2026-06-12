import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderService } from '../application/order.service';
import { UserRepository } from '../infrastructure/user.repository';
import { OrderAction, OrderStatus, Role, OrderStatusLabels, BatchProcessResult } from '../types';

@Controller('api/orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly userRepository: UserRepository,
  ) {}

  @Get()
  async getOrders(
    @Headers('x-operator-id') operatorId: string,
    @Query('status') status?: string,
    @Query('myTasks') myTasks?: string,
    @Query('handlerRole') handlerRole?: string,
  ) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }

    const operator = await this.userRepository.findById(operatorId);
    if (!operator) {
      throw new ForbiddenException('操作人不存在');
    }

    const filters: { status?: OrderStatus[]; handlerRole?: Role; handlerId?: string } = {};

    if (status) {
      const statuses = status.split(',').filter(Boolean) as OrderStatus[];
      if (statuses.length > 0) {
        filters.status = statuses;
      }
    }

    if (handlerRole && handlerRole !== 'all') {
      filters.handlerRole = handlerRole as Role;
    }

    if (myTasks === 'true') {
      filters.handlerId = operatorId;
    } else if (!handlerRole) {
      filters.handlerRole = operator.role;
    }

    return this.orderService.getOrderList(filters);
  }

  @Get('statistics')
  async getStatistics(@Headers('x-operator-id') operatorId: string) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    return this.orderService.getStatistics(operatorId);
  }

  @Get(':id')
  async getOrderDetail(
    @Param('id') id: string,
    @Headers('x-operator-id') operatorId: string,
  ) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    return this.orderService.getOrderDetail(id, operatorId);
  }

  @Get(':id/audit-logs')
  async getAuditLogs(@Param('id') id: string) {
    return this.orderService.getAuditLogs(id);
  }

  @Post()
  async createOrder(
    @Body()
    body: {
      venueName: string;
      venueType: string;
      bookingDate: string;
      bookingTime: string;
      applicantName: string;
      applicantPhone: string;
      applicantIdCard: string;
      materials: Array<{ type: string; uploaded: boolean; url?: string }>;
      comment: string;
    },
    @Headers('x-operator-id') operatorId: string,
  ) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    return this.orderService.submitRegistration({
      ...body,
      materials: body.materials.map((m) => ({
        id: '',
        name: '',
        type: m.type,
        uploaded: m.uploaded,
        url: m.url,
        required: true,
      })),
      operatorId,
    });
  }

  @Put(':id/process')
  async processOrder(
    @Param('id') id: string,
    @Body()
    body: {
      action: OrderAction;
      comment: string;
      materials?: Array<{ id?: string; type: string; uploaded: boolean; url?: string }>;
    },
    @Headers('x-operator-id') operatorId: string,
    @Headers('x-forwarded-for') ipAddress?: string,
  ) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    if (!body.action) {
      throw new BadRequestException('缺少操作类型');
    }
    if (!body.comment || body.comment.trim().length === 0) {
      throw new BadRequestException('处理意见不能为空');
    }

    return this.orderService.processOrder({
      orderId: id,
      operatorId,
      action: body.action,
      comment: body.comment,
      materials: body.materials?.map((m) => ({
        id: m.id || '',
        name: '',
        type: m.type,
        uploaded: m.uploaded,
        url: m.url,
        required: true,
      })),
      ipAddress,
    });
  }

  @Post('batch-process')
  async batchProcess(
    @Body()
    body: {
      orderIds: string[];
      action: OrderAction;
      comment: string;
    },
    @Headers('x-operator-id') operatorId: string,
    @Headers('x-forwarded-for') ipAddress?: string,
  ): Promise<BatchProcessResult> {
    if (!operatorId) {
      throw new BadRequestException('缺少操作人标识 x-operator-id');
    }
    if (!body.orderIds || body.orderIds.length === 0) {
      throw new BadRequestException('请选择要处理的订单');
    }
    if (!body.action) {
      throw new BadRequestException('缺少操作类型');
    }
    if (!body.comment || body.comment.trim().length === 0) {
      throw new BadRequestException('处理意见不能为空');
    }

    return this.orderService.batchProcess({
      orderIds: body.orderIds,
      operatorId,
      action: body.action,
      comment: body.comment,
      ipAddress,
    });
  }

  @Get('meta/statuses')
  async getStatuses() {
    return Object.entries(OrderStatusLabels).map(([value, label]) => ({
      value,
      label,
    }));
  }

  @Get('meta/actions')
  async getActions() {
    const actionLabels: Record<OrderAction, string> = {
      [OrderAction.SUBMIT_REGISTRATION]: '提交登记',
      [OrderAction.REQUEST_CORRECTION]: '要求补正',
      [OrderAction.SUBMIT_CORRECTION]: '提交补正',
      [OrderAction.APPROVE_REVIEW]: '审核通过',
      [OrderAction.REJECT_REVIEW]: '审核驳回',
      [OrderAction.APPROVE_FINAL_REVIEW]: '复核通过归档',
      [OrderAction.REJECT_FINAL_REVIEW]: '复核驳回',
    };

    return Object.entries(actionLabels).map(([value, label]) => ({
      value,
      label,
    }));
  }
}
