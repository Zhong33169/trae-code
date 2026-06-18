import { Controller, Get } from '@nestjs/common';
import { ProgressReportsService } from '../progress-reports/progress-reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly progressReportsService: ProgressReportsService) {}

  @Get('overview')
  getOverview(@CurrentUser() user?: User) {
    return this.progressReportsService.getStatistics(user);
  }
}
