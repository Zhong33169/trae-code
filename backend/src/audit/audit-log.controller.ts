import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditLogService } from './audit-log.service';
import { AuditAction } from '../entities/audit-log.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../entities/user.entity';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  @Roles(UserRole.SUPERVISOR, UserRole.REVIEWER)
  async findAll(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('orderId') orderId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('success') success?: string,
  ) {
    return this.auditLogService.findAll({
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      orderId,
      userId,
      action,
      success: success !== undefined ? success === 'true' : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.SUPERVISOR, UserRole.REVIEWER)
  async findOne(@Param('id') id: string) {
    return this.auditLogService.findOne(id);
  }

  @Get('order/:orderId')
  async getOrderAuditLogs(@Param('orderId') orderId: string) {
    return this.auditLogService.getOrderAuditLogs(orderId);
  }
}
