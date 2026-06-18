import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProgressStatus } from '../../../common/enums/progress-status.enum';
import { TimeoutStatus } from '../../../common/enums/timeout-status.enum';
import { User } from '../../users/entities/user.entity';
import { WeeklyReport } from '../../weekly-reports/entities/weekly-report.entity';
import { DeviationAnalysis } from '../../deviation-analysis/entities/deviation-analysis.entity';
import { OwnerReport } from '../../owner-reports/entities/owner-report.entity';
import { OperationLog } from '../../operation-logs/entities/operation-log.entity';

@Entity('progress_reports')
export class ProgressReport extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'simple-enum', enum: ProgressStatus, default: ProgressStatus.DRAFT })
  status: ProgressStatus;

  @Column({ type: 'simple-enum', enum: TimeoutStatus, default: TimeoutStatus.NORMAL })
  timeoutStatus: TimeoutStatus;

  @Column({ type: 'datetime' })
  deadline: Date;

  @Column({ type: 'date', nullable: true })
  reportDate: Date;

  @Column({ nullable: true })
  projectName: string;

  @Column({ type: 'text', nullable: true })
  abnormalReason: string;

  @Column({ type: 'text', nullable: true })
  lastProcessResult: string;

  @Column({ type: 'integer', default: 0 })
  reviewCount: number;

  @Column({ type: 'integer', default: 0 })
  verificationCount: number;

  @Column({ type: 'datetime', nullable: true })
  currentNodeEnteredAt: Date;

  @Column({ type: 'integer', default: 0 })
  timeoutDays: number;

  @Column({ type: 'text', nullable: true })
  timeoutReason: string;

  @Column({ type: 'text', nullable: true })
  timeoutFollowUp: string;

  @Column({ type: 'datetime', nullable: true })
  timeoutHandledAt: Date;

  @Column({ type: 'uuid', nullable: true })
  responsiblePersonId: string;

  @ManyToOne(() => User, (user) => user.responsibleReports)
  @JoinColumn({ name: 'responsiblePersonId' })
  responsiblePerson: User;

  @OneToMany(() => WeeklyReport, (weekly) => weekly.progressReport)
  weeklyReports: WeeklyReport[];

  @OneToMany(() => DeviationAnalysis, (deviation) => deviation.progressReport)
  deviationAnalyses: DeviationAnalysis[];

  @OneToMany(() => OwnerReport, (owner) => owner.progressReport)
  ownerReports: OwnerReport[];

  @OneToMany(() => OperationLog, (log) => log.progressReport)
  operationLogs: OperationLog[];
}
