import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyReportsService } from './weekly-reports.service';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReport } from './entities/weekly-report.entity';
import { ProgressReportsModule } from '../progress-reports/progress-reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyReport]),
    ProgressReportsModule,
  ],
  controllers: [WeeklyReportsController],
  providers: [WeeklyReportsService],
  exports: [WeeklyReportsService],
})
export class WeeklyReportsModule {}
