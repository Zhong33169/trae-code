import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OperationType } from '../../../common/enums/operation-type.enum';
import { ProgressStatus } from '../../../common/enums/progress-status.enum';
import { User } from '../../users/entities/user.entity';
import { ProgressReport } from '../../progress-reports/entities/progress-report.entity';

@Entity('operation_logs')
export class OperationLog extends BaseEntity {
  @Column({ type: 'simple-enum', enum: OperationType })
  operationType: OperationType;

  @Column({ type: 'text', nullable: true })
  operationDetail: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'simple-enum', enum: ProgressStatus, nullable: true })
  fromStatus: ProgressStatus;

  @Column({ type: 'simple-enum', enum: ProgressStatus, nullable: true })
  toStatus: ProgressStatus;

  @Column({ type: 'uuid' })
  operatorId: string;

  @ManyToOne(() => User, (user) => user.operationLogs)
  @JoinColumn({ name: 'operatorId' })
  operator: User;

  @Column({ type: 'uuid' })
  progressReportId: string;

  @ManyToOne(() => ProgressReport, (report) => report.operationLogs)
  @JoinColumn({ name: 'progressReportId' })
  progressReport: ProgressReport;
}
