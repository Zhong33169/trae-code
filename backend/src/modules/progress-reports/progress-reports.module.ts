import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressReportsService } from './progress-reports.service';
import { ProgressReportsController } from './progress-reports.controller';
import { ProgressReport } from './entities/progress-report.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProgressReport]),
    OperationLogsModule,
  ],
  controllers: [ProgressReportsController],
  providers: [ProgressReportsService],
  exports: [ProgressReportsService],
})
export class ProgressReportsModule {}
