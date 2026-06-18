import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProgressReport } from '../../progress-reports/entities/progress-report.entity';

@Entity('owner_reports')
export class OwnerReport extends BaseEntity {
  @Column()
  reportTitle: string;

  @Column({ type: 'text' })
  reportContent: string;

  @Column({ type: 'date' })
  reportDate: Date;

  @Column({ type: 'text', nullable: true })
  ownerFeedback: string;

  @Column({ type: 'boolean', default: false })
  ownerAcknowledged: boolean;

  @Column({ type: 'uuid' })
  progressReportId: string;

  @ManyToOne(() => ProgressReport, (report) => report.ownerReports)
  @JoinColumn({ name: 'progressReportId' })
  progressReport: ProgressReport;
}
