import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrderService, CreateOrderDto, UpdateOrderDto } from './order.service';
import { OrderStatus, OrderSource } from '../entities/order.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { diskStorage } from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post()
  @Roles(UserRole.REGISTRAR)
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: User) {
    return this.orderService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('status') status?: OrderStatus,
    @Query('statuses') statuses?: string,
    @Query('source') source?: OrderSource,
    @Query('keyword') keyword?: string,
    @Query('communityName') communityName?: string,
    @Query('hasException') hasException?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: User,
  ) {
    const statusList = statuses ? (statuses as string).split(',') as OrderStatus[] : undefined;

    return this.orderService.findAll({
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      status,
      statuses: statusList,
      source,
      keyword,
      communityName,
      hasException: hasException === 'true',
      startDate,
      endDate,
    });
  }

  @Get('statistics')
  async getStatistics() {
    return this.orderService.getStatistics();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.orderService.update(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(UserRole.REGISTRAR)
  async submitForReview(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.submitForReview(id, user);
  }

  @Post(':id/review-approve')
  @Roles(UserRole.SUPERVISOR)
  async reviewApprove(
    @Param('id') id: string,
    @Body() body: { auditRemark?: string },
    @CurrentUser() user: User,
  ) {
    return this.orderService.reviewApprove(id, user, body.auditRemark);
  }

  @Post(':id/review-reject')
  @Roles(UserRole.SUPERVISOR)
  async reviewReject(
    @Param('id') id: string,
    @Body() body: { rejectReason: string },
    @CurrentUser() user: User,
  ) {
    if (!body.rejectReason) {
      throw new BadRequestException('退回原因不能为空');
    }
    return this.orderService.reviewReject(id, user, body.rejectReason);
  }

  @Post(':id/submit-final')
  @Roles(UserRole.SUPERVISOR)
  async submitForFinalReview(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.submitForFinalReview(id, user);
  }

  @Post(':id/final-approve')
  @Roles(UserRole.REVIEWER)
  async finalApprove(
    @Param('id') id: string,
    @Body() body: { auditRemark?: string },
    @CurrentUser() user: User,
  ) {
    return this.orderService.finalApprove(id, user, body.auditRemark);
  }

  @Post(':id/final-reject')
  @Roles(UserRole.REVIEWER)
  async finalReject(
    @Param('id') id: string,
    @Body() body: { rejectReason: string },
    @CurrentUser() user: User,
  ) {
    if (!body.rejectReason) {
      throw new BadRequestException('退回原因不能为空');
    }
    return this.orderService.finalReject(id, user, body.rejectReason);
  }

  @Post(':id/ship')
  @Roles(UserRole.SUPERVISOR)
  async ship(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.ship(id, user);
  }

  @Post(':id/deliver')
  @Roles(UserRole.SUPERVISOR, UserRole.REGISTRAR)
  async deliver(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.deliver(id, user);
  }

  @Post(':id/sign')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async sign(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.sign(id, user);
  }

  @Post(':id/archive')
  @Roles(UserRole.REVIEWER)
  async archive(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.archive(id, user);
  }

  @Post(':id/exception')
  @Roles(UserRole.SUPERVISOR, UserRole.REVIEWER)
  async markException(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    if (!body.reason) {
      throw new BadRequestException('异常原因不能为空');
    }
    return this.orderService.markException(id, user, body.reason);
  }

  @Post(':id/materials-missing')
  @Roles(UserRole.SUPERVISOR)
  async markMaterialsMissing(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    if (!body.reason) {
      throw new BadRequestException('缺失材料说明不能为空');
    }
    return this.orderService.markMaterialsMissing(id, user, body.reason);
  }

  @Post(':id/timeout')
  @Roles(UserRole.SUPERVISOR)
  async markTimeout(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    if (!body.reason) {
      throw new BadRequestException('超时原因不能为空');
    }
    return this.orderService.markTimeout(id, user, body.reason);
  }

  @Post(':id/return')
  @Roles(UserRole.SUPERVISOR, UserRole.REVIEWER)
  async returnOrder(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    if (!body.reason) {
      throw new BadRequestException('退回原因不能为空');
    }
    return this.orderService.returnOrder(id, user, body.reason);
  }

  @Post(':id/rectify')
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async rectify(@Param('id') id: string, @CurrentUser() user: User) {
    return this.orderService.rectify(id, user);
  }

  @Post('batch')
  async batchProcess(
    @Body() body: { ids: string[]; action: string; reason?: string },
    @CurrentUser() user: User,
  ) {
    if (!body.ids || body.ids.length === 0) {
      throw new BadRequestException('请选择要处理的订单');
    }
    if (!body.action) {
      throw new BadRequestException('请指定操作类型');
    }
    return this.orderService.batchProcess(body.ids, body.action, user, body.reason);
  }

  @Get(':id/attachments')
  async getAttachments(@Param('id') id: string) {
    return this.orderService.getAttachments(id);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: path.resolve(__dirname, '../../uploads'),
      filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
      },
    }),
  }))
  @Roles(UserRole.REGISTRAR, UserRole.SUPERVISOR)
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }
    return this.orderService.addAttachment(
      id,
      {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      type || 'other',
      user,
    );
  }
}
