import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PlanService } from './plan.service';
import { ok } from '../common/dto';
import { PlanStatus, Shift, UserRole } from '../common/constants';
import { Transform } from 'class-transformer';

class CreateDto {
  @IsString({ message: '标题必须为字符串' })
  @MaxLength(200, { message: '标题不能超过200字' })
  title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() targetAudience?: string;
  @IsOptional() @IsString() planPublishTime?: string;
}
class UpdateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() targetAudience?: string;
  @IsOptional() @IsString() planPublishTime?: string;
  @IsOptional() @IsString() materialInfo?: string;
}
class AuditDto {
  @IsBoolean({ message: 'pass 必须为布尔值' }) pass: boolean;
  @IsOptional() @IsString() remark?: string;
}
class SubmitMaterialDto {
  @IsOptional() @IsString() materialInfo?: string;
}
class HandoverDto {
  @IsInt() toUserId: number;
  @IsEnum(Shift) fromShift: Shift;
  @IsEnum(Shift) toShift: Shift;
  @IsOptional() @IsString() remark?: string;
}
class BatchAuditDto {
  @IsArray() @IsInt({ each: true }) ids: number[];
  @IsBoolean() pass: boolean;
  @IsOptional() @IsString() remark?: string;
}

@Controller('plans')
@UseGuards(AuthGuard('jwt'))
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  async list(@Request() req, @Query() q: any) {
    const page = q.page ? +q.page : undefined;
    const pageSize = q.pageSize ? +q.pageSize : undefined;
    const result = await this.planService.list(req.user, {
      page, pageSize, keyword: q.keyword, status: q.status as PlanStatus,
      onlyMine: q.onlyMine === 'true' || q.onlyMine === true,
    });
    return ok(result);
  }

  @Get('statistics')
  async statistics(@Request() req) {
    return ok(await this.planService.statistics(req.user), '获取统计成功');
  }

  @Get('receivers')
  async receivers(@Query('role') role: UserRole, @Request() req) {
    return ok(await this.planService.listReceivers(role as UserRole, req.user?.id));
  }

  @Get(':id')
  async detail(@Param('id', Transform((v) => +v.value)) id: number, @Request() req) {
    return ok(await this.planService.detail(id, req.user));
  }

  @Post()
  async create(@Body() dto: CreateDto, @Request() req) {
    return ok(await this.planService.create(req.user, dto), '创建成功');
  }

  @Put(':id')
  async update(@Param('id', Transform((v) => +v.value)) id: number, @Body() dto: UpdateDto, @Request() req) {
    return ok(await this.planService.update(id, req.user, dto), '更新成功');
  }

  @Post(':id/submit-audit')
  async submitAudit(@Param('id', Transform((v) => +v.value)) id: number, @Request() req) {
    return ok(await this.planService.submitAudit(id, req.user), '已提交审核');
  }

  @Post(':id/audit')
  async audit(@Param('id', Transform((v) => +v.value)) id: number, @Body() dto: AuditDto, @Request() req) {
    const r = await this.planService.audit(id, req.user, dto.pass, dto.remark);
    return ok(r, dto.pass ? '审核通过' : '已退回补正');
  }

  @Post(':id/submit-material')
  async submitMaterial(@Param('id', Transform((v) => +v.value)) id: number, @Body() dto: SubmitMaterialDto, @Request() req) {
    return ok(await this.planService.submitMaterial(id, req.user, dto), '素材已提交审核');
  }

  @Post(':id/audit-material')
  async auditMaterial(@Param('id', Transform((v) => +v.value)) id: number, @Body() dto: AuditDto, @Request() req) {
    const r = await this.planService.auditMaterial(id, req.user, dto.pass, dto.remark);
    return ok(r, dto.pass ? '素材审核通过' : '素材审核不通过');
  }

  @Post(':id/confirm-delivery')
  async confirmDelivery(@Param('id', Transform((v) => +v.value)) id: number, @Body('remark') remark: string, @Request() req) {
    return ok(await this.planService.confirmDelivery(id, req.user, remark), '投放确认完成');
  }

  @Post(':id/archive')
  async archive(@Param('id', Transform((v) => +v.value)) id: number, @Body('remark') remark: string, @Request() req) {
    return ok(await this.planService.archive(id, req.user, remark), '复核归档完成，流程已闭环');
  }

  @Post(':id/handover')
  async handover(@Param('id', Transform((v) => +v.value)) id: number, @Body() dto: HandoverDto, @Request() req) {
    const r = await this.planService.handover(id, req.user, dto);
    return ok(r, '交接确认成功，详情已同步更新接收人');
  }

  @Post('batch/audit')
  async batchAudit(@Body() dto: BatchAuditDto, @Request() req) {
    const r = await this.planService.batchAudit(req.user, dto.ids, dto.pass, dto.remark);
    const succ = r.filter(x => x.success).length;
    return ok({ results: r, successCount: succ, failCount: r.length - succ },
      `批量处理：成功${succ}条，失败${r.length - succ}条`);
  }
}
