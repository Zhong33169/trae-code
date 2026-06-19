import { Controller, Get, Post, Put, Body, Param, Query, Req } from '@nestjs/common';
import {
  HarvestService,
  CreateHarvestDto,
  SubmitVerifyDto,
  ProcessDto,
  ScanVerifyDto,
  BatchProcessDto,
} from './harvest.service';
import { AuthRequest } from './auth.middleware';
import { Role } from './types';

@Controller('harvest')
export class HarvestController {
  constructor(private readonly harvestService: HarvestService) {}

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string
  ) {
    return this.harvestService.findAll(req.user.id, req.user.role as Role, { status, keyword });
  }

  @Get('statistics')
  getStatistics(@Req() req: AuthRequest) {
    return this.harvestService.getStatistics(req.user.id, req.user.role as Role);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.harvestService.findById(id);
  }

  @Get(':id/scans')
  getScanRecords(@Param('id') id: string) {
    return this.harvestService.getScanRecords(id);
  }

  @Get(':id/audits')
  getAuditLogs(@Param('id') id: string) {
    return this.harvestService.getAuditLogs(id);
  }

  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.harvestService.getComments(id);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateHarvestDto) {
    return this.harvestService.create(req.user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Req() req: AuthRequest, @Body() dto: Partial<CreateHarvestDto>) {
    return this.harvestService.update(id, req.user.id, dto);
  }

  @Post(':id/submit')
  submitForVerification(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: SubmitVerifyDto
  ) {
    return this.harvestService.submitForVerification(id, req.user.id, dto);
  }

  @Post(':id/scan')
  scanVerify(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: ScanVerifyDto
  ) {
    return this.harvestService.scanVerify(id, req.user.id, req.user.role as Role, dto);
  }

  @Post(':id/process')
  process(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: ProcessDto
  ) {
    return this.harvestService.processRecord(id, req.user.id, req.user.role as Role, dto);
  }

  @Post('batch')
  batchProcess(@Req() req: AuthRequest, @Body() dto: BatchProcessDto) {
    return this.harvestService.batchProcess(req.user.id, req.user.role as Role, dto);
  }
}
