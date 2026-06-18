import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerReportsService } from './owner-reports.service';
import { OwnerReportsController } from './owner-reports.controller';
import { OwnerReport } from './entities/owner-report.entity';
import { ProgressReportsModule } from '../progress-reports/progress-reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OwnerReport]),
    ProgressReportsModule,
  ],
  controllers: [OwnerReportsController],
  providers: [OwnerReportsService],
  exports: [OwnerReportsService],
})
export class OwnerReportsModule {}
