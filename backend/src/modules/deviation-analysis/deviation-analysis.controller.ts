import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DeviationAnalysisService } from './deviation-analysis.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('deviation-analysis')
export class DeviationAnalysisController {
  constructor(private readonly deviationAnalysisService: DeviationAnalysisService) {}

  @Post()
  @Roles(Role.SUPERVISOR)
  create(@Body() data: any, @CurrentUser() user: User) {
    return this.deviationAnalysisService.create(data, user);
  }

  @Get()
  findAll(@Query('progressReportId') progressReportId?: string) {
    return this.deviationAnalysisService.findAll(progressReportId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deviationAnalysisService.findOne(id);
  }

  @Post(':id/approve')
  @Roles(Role.SUPERVISOR_ENGINEER)
  approve(
    @Param('id') id: string,
    @Body('opinion') opinion: string,
    @CurrentUser() user: User,
  ) {
    return this.deviationAnalysisService.approve(id, opinion, user);
  }

  @Patch(':id')
  @Roles(Role.SUPERVISOR)
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: User) {
    return this.deviationAnalysisService.update(id, data, user);
  }

  @Delete(':id')
  @Roles(Role.SUPERVISOR_ENGINEER)
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.deviationAnalysisService.remove(id, user);
  }
}
