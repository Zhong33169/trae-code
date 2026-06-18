import { Controller, Get, Param, Query } from '@nestjs/common';
import { OperationLogsService } from './operation-logs.service';
import { OperationType } from '../../common/enums/operation-type.enum';

@Controller('operation-logs')
export class OperationLogsController {
  constructor(private readonly operationLogsService: OperationLogsService) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('operatorId') operatorId?: string,
    @Query('operationType') operationType?: OperationType,
    @Query('progressReportId') progressReportId?: string,
  ) {
    return this.operationLogsService.findAll({
      page,
      pageSize,
      operatorId,
      operationType,
      progressReportId,
    });
  }

  @Get('progress-report/:id')
  findByProgressReportId(@Param('id') id: string) {
    return this.operationLogsService.findByProgressReportId(id);
  }
}
