import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { WeeklyReportsService } from './weekly-reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('weekly-reports')
export class WeeklyReportsController {
  constructor(private readonly weeklyReportsService: WeeklyReportsService) {}

  @Post()
  @Roles(Role.REGISTRAR)
  create(@Body() data: any, @CurrentUser() user: User) {
    return this.weeklyReportsService.create(data, user);
  }

  @Get()
  findAll(@Query('progressReportId') progressReportId?: string) {
    return this.weeklyReportsService.findAll(progressReportId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.weeklyReportsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.REGISTRAR)
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: User) {
    return this.weeklyReportsService.update(id, data, user);
  }

  @Delete(':id')
  @Roles(Role.SUPERVISOR_ENGINEER)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.weeklyReportsService.remove(id, user);
  }
}
