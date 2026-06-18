import {
  Controller, Get, Post, Put, Param, Body, Query, Request,
  UseGuards, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { PlanService } from './plan.service';
import { ok } from '../common/dto';
import { PlanStatus, Shift, UserRole } from '../common/constants';
import { Type } from 'class-transformer';

const STATUS_VALUES = Object.values(PlanStatus);
const ROLE_VALUES = Object.values(UserRole);
const SHIFT_VALUES = Object.values(Shift);

export class CreateDto {
  @IsString({ message: '标题必须为字符串' })
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(200, { message: '标题不能超过200字' })
  title: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() targetAudience?: string;
  @IsOptional() @IsString() planPublishTime?: string;
}
export class UpdateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() targetAudience?: string;
  @IsOptional() @IsString() planPublishTime?: string;
  @IsOptional() @IsString() materialInfo?: string;
}
export class AuditDto {
  @IsBoolean({ message: 'pass 必须为布尔值（true/false）' })
  pass: boolean;
  @IsOptional() @IsString() remark?: string;
}
export class SubmitMaterialDto {
  @IsOptional() @IsString() materialInfo?: string;
}
export class HandoverDto {
  @IsInt({ message: 'toUserId 必须为整数' })
  toUserId: number;
  @IsEnum(Shift, { message: `fromShift 必须是 ${SHIFT_VALUES.join('/')}` })
  fromShift: Shift;
  @IsEnum(Shift, { message: `toShift 必须是 ${SHIFT_VALUES.join('/')}` })
  toShift: Shift;
  @IsOptional() @IsString() remark?: string;
}
export class AcceptHandoverDto {
  @IsOptional() @IsString() acceptRemark?: string;
}
export class BatchAuditDto {
  @IsArray({ message: 'ids 必须为数组' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'ids 每项必须为整数' })
  ids: number[];
  @IsBoolean({ message: 'pass 必须为布尔值' })
  pass: boolean;
  @IsOptional() @IsString() remark?: string;
}
export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsIn(STATUS_VALUES, { message: `status 必须是：${STATUS_VALUES.join('/')}` })
  status?: PlanStatus;
  @IsOptional() @IsIn(['true', 'false', true, false], { message: 'onlyMine 必须是 true/false' })
  onlyMine?: any;
}

@Controller('plans')
@UseGuards(AuthGuard('jwt'))
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  async list(@Request() req, @Query() q: ListQueryDto) {
    const onlyMine = q.onlyMine === true || String(q.onlyMine) === 'true';
    const result = await this.planService.list(req.user, {
      page: q.page, pageSize: q.pageSize, keyword: q.keyword, status: q.status, onlyMine,
    });
    return ok(result);
  }

  @Get('statistics')
  async statistics(@Request() req) {
    return ok(await this.planService.statistics(req.user), '获取统计成功');
  }

  @Get('receivers')
  async receivers(@Query('role') role: string, @Request() req) {
    if (!role || !ROLE_VALUES.includes(role as any)) {
      throw new BadRequestException(`role 参数必须是 ${ROLE_VALUES.join('/')}`);
    }
    return ok(await this.planService.listReceivers(role as UserRole, req.user?.id));
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return ok(await this.planService.detail(id, req.user));
  }

  @Post()
  async create(@Body() dto: CreateDto, @Request() req) {
    return ok(await this.planService.create(req.user, dto), '创建成功');
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDto, @Request() req) {
    return ok(await this.planService.update(id, req.user, dto), '更新成功');
  }

  @Post(':id/submit-audit')
  async submitAudit(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return ok(await this.planService.submitAudit(id, req.user), '已提交审核');
  }

  @Post(':id/audit')
  async audit(@Param('id', ParseIntPipe) id: number, @Body() dto: AuditDto, @Request() req) {
    const r = await this.planService.audit(id, req.user, dto.pass, dto.remark);
    return ok(r, dto.pass ? '审核通过' : '已退回补正');
  }

  @Post(':id/submit-material')
  async submitMaterial(@Param('id', ParseIntPipe) id: number, @Body() dto: SubmitMaterialDto, @Request() req) {
    return ok(await this.planService.submitMaterial(id, req.user, dto), '素材已提交审核');
  }

  @Post(':id/audit-material')
  async auditMaterial(@Param('id', ParseIntPipe) id: number, @Body() dto: AuditDto, @Request() req) {
    const r = await this.planService.auditMaterial(id, req.user, dto.pass, dto.remark);
    return ok(r, dto.pass ? '素材审核通过' : '素材审核不通过');
  }

  @Post(':id/confirm-delivery')
  async confirmDelivery(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { remark?: string },
    @Request() req,
  ) {
    return ok(
      await this.planService.confirmDelivery(id, req.user, body?.remark),
      '投放确认完成',
    );
  }

  @Post(':id/archive')
  async archive(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { remark?: string },
    @Request() req,
  ) {
    return ok(
      await this.planService.archive(id, req.user, body?.remark),
      '复核归档完成，流程已闭环',
    );
  }

  @Post(':id/handover')
  async handover(@Param('id', ParseIntPipe) id: number, @Body() dto: HandoverDto, @Request() req) {
    const r = await this.planService.handover(id, req.user, dto);
    return ok(r, '已提交交接，待接收人确认后继续办理');
  }

  @Post(':id/accept-handover')
  async acceptHandover(@Param('id', ParseIntPipe) id: number, @Body() dto: AcceptHandoverDto, @Request() req) {
    return ok(await this.planService.acceptHandover(id, req.user, dto), '已确认接收，可继续办理');
  }

  @Post('batch/audit')
  async batchAudit(@Body() dto: BatchAuditDto, @Request() req) {
    if (!dto.ids || dto.ids.length === 0) {
      throw new BadRequestException('ids 不能为空');
    }
    if (dto.ids.length > 100) {
      throw new BadRequestException('批量最多 100 条');
    }
    const r = await this.planService.batchAudit(req.user, dto.ids, dto.pass, dto.remark);
    const succ = r.filter((x) => x.success).length;
    return ok(
      { results: r, successCount: succ, failCount: r.length - succ },
      `批量处理：成功${succ}条，失败${r.length - succ}条`,
    );
  }
}
