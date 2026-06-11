import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { TaskService, CreateTaskDto, TaskQueryDto, AuditTaskDto } from './task.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('tasks')
@UseGuards(AuthGuard)
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Get()
  async getTaskList(@Query() query: TaskQueryDto, @Req() req) {
    const result = await this.taskService.getTaskList(query, req.user.role);
    return {
      code: 0,
      message: '获取成功',
      data: result,
    };
  }

  @Get('statistics')
  async getStatistics(@Req() req) {
    const result = await this.taskService.getStatistics(req.user.role);
    return {
      code: 0,
      message: '获取成功',
      data: result,
    };
  }

  @Get(':id')
  async getTaskDetail(@Param('id') id: string) {
    const result = await this.taskService.getTaskDetail(parseInt(id, 10));
    return {
      code: 0,
      message: '获取成功',
      data: result,
    };
  }

  @Get(':id/logs')
  async getOperationLogs(@Param('id') id: string) {
    const result = await this.taskService.getOperationLogs(parseInt(id, 10));
    return {
      code: 0,
      message: '获取成功',
      data: result,
    };
  }

  @Post('create')
  async createTask(@Body() body: CreateTaskDto, @Req() req) {
    const result = await this.taskService.createTask(body, req.user.id, req.user.name, req.user.role);
    return {
      code: 0,
      message: '创建成功',
      data: result,
    };
  }

  @Post('register')
  async registerTask(@Body() body: { taskId: number }, @Req() req) {
    const result = await this.taskService.registerTask(body.taskId, req.user.id, req.user.name, req.user.role);
    return {
      code: 0,
      message: '登记成功',
      data: result,
    };
  }

  @Post('audit')
  async auditTask(@Body() body: AuditTaskDto, @Req() req) {
    const result = await this.taskService.auditTask(body, req.user.id, req.user.name, req.user.role);
    return {
      code: 0,
      message: body.passed ? '审核通过' : '审核驳回',
      data: result,
    };
  }

  @Post('review')
  async reviewTask(@Body() body: AuditTaskDto, @Req() req) {
    const result = await this.taskService.reviewTask(body, req.user.id, req.user.name, req.user.role);
    return {
      code: 0,
      message: body.passed ? '复核通过，已归档' : '复核驳回',
      data: result,
    };
  }
}
