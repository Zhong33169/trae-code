import { Controller, Get, Param } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getAllLogs() {
    return this.auditService.getAllLogs();
  }

  @Get('plan/:planId')
  getLogsByPlanId(@Param('planId') planId: string) {
    return this.auditService.getLogsByPlanId(planId);
  }
}
