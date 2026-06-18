import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProgressReport } from '../../progress-reports/entities/progress-report.entity';

@Entity('deviation_analyses')
export class DeviationAnalysis extends BaseEntity {
  @Column({ type: 'text' })
  deviationDescription: string;

  @Column({ type: 'text' })
  causeAnalysis: string;

  @Column({ type: 'text' })
  impactAssessment: string;

  @Column({ type: 'text' })
  correctionMeasures: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  deviationPercentage: number;

  @Column({ type: 'boolean', default: false })
  isApproved: boolean;

  @Column({ type: 'text', nullable: true })
  approvalOpinion: string;

  @Column({ type: 'uuid' })
  progressReportId: string;

  @ManyToOne(() => ProgressReport, (report) => report.deviationAnalyses)
  @JoinColumn({ name: 'progressReportId' })
  progressReport: ProgressReport;
}
