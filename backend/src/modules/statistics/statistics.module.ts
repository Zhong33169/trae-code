import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { ProgressReportsModule } from '../progress-reports/progress-reports.module';

@Module({
  imports: [ProgressReportsModule],
  controllers: [StatisticsController],
})
export class StatisticsModule {}
