import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviationAnalysisService } from './deviation-analysis.service';
import { DeviationAnalysisController } from './deviation-analysis.controller';
import { DeviationAnalysis } from './entities/deviation-analysis.entity';
import { ProgressReportsModule } from '../progress-reports/progress-reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviationAnalysis]),
    ProgressReportsModule,
  ],
  controllers: [DeviationAnalysisController],
  providers: [DeviationAnalysisService],
  exports: [DeviationAnalysisService],
})
export class DeviationAnalysisModule {}
