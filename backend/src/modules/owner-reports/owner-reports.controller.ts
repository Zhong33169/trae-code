import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OwnerReportsService } from './owner-reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('owner-reports')
export class OwnerReportsController {
  constructor(private readonly ownerReportsService: OwnerReportsService) {}

  @Post()
  @Roles(Role.SUPERVISOR)
  create(@Body() data: any, @CurrentUser() user: User) {
    return this.ownerReportsService.create(data, user);
  }

  @Get()
  findAll(@Query('progressReportId') progressReportId?: string) {
    return this.ownerReportsService.findAll(progressReportId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ownerReportsService.findOne(id);
  }

  @Post(':id/acknowledge')
  @Roles(Role.SUPERVISOR_ENGINEER)
  acknowledge(
    @Param('id') id: string,
    @Body('feedback') feedback: string,
    @CurrentUser() user: User,
  ) {
    return this.ownerReportsService.acknowledge(id, feedback, user);
  }

  @Patch(':id')
  @Roles(Role.SUPERVISOR)
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: User) {
    return this.ownerReportsService.update(id, data, user);
  }

  @Delete(':id')
  @Roles(Role.SUPERVISOR_ENGINEER)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ownerReportsService.remove(id, user);
  }
}
