import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProgressReport } from '../../progress-reports/entities/progress-report.entity';

@Entity('weekly_reports')
export class WeeklyReport extends BaseEntity {
  @Column({ type: 'date' })
  weekStartDate: Date;

  @Column({ type: 'date' })
  weekEndDate: Date;

  @Column({ type: 'text', nullable: true })
  weekProgress: string;

  @Column({ type: 'text', nullable: true })
  nextWeekPlan: string;

  @Column({ type: 'text', nullable: true })
  existingProblems: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionRate: number;

  @Column({ type: 'uuid' })
  progressReportId: string;

  @ManyToOne(() => ProgressReport, (report) => report.weeklyReports)
  @JoinColumn({ name: 'progressReportId' })
  progressReport: ProgressReport;
}
