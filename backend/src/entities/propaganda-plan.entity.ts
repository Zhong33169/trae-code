import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Index,
} from 'typeorm';
import { PlanStatus, UserRole } from '../common/constants';
import { User } from './user.entity';
import { HandoverRecord } from './handover-record.entity';
import { OperationLog } from './operation-log.entity';

@Entity('propaganda_plans')
export class PropagandaPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 30 })
  @Index()
  planNo: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'simple-enum', enum: PlanStatus, default: PlanStatus.DRAFT })
  @Index()
  status: PlanStatus;

  @Column({ length: 100, nullable: true })
  channel: string;

  @Column({ type: 'text', nullable: true })
  targetAudience: string;

  @Column({ type: 'datetime', nullable: true })
  planPublishTime: Date;

  @Column({ type: 'text', nullable: true })
  materialInfo: string;

  @Column({ type: 'simple-enum', enum: UserRole, nullable: true })
  currentHandlerRole: UserRole;

  @Column({ type: 'integer', nullable: true })
  currentHandlerId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'currentHandlerId' })
  currentHandler: User;

  @Column({ type: 'integer' })
  createdById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'text', nullable: true })
  auditRemark: string;

  @Column({ type: 'text', nullable: true })
  materialRemark: string;

  @Column({ type: 'text', nullable: true })
  deliveryRemark: string;

  @Column({ type: 'text', nullable: true })
  reviewRemark: string;

  @Column({ type: 'datetime', nullable: true })
  auditTime: Date;

  @Column({ type: 'datetime', nullable: true })
  materialTime: Date;

  @Column({ type: 'datetime', nullable: true })
  deliveryTime: Date;

  @Column({ type: 'datetime', nullable: true })
  archiveTime: Date;

  @OneToMany(() => HandoverRecord, (r) => r.plan)
  handovers: HandoverRecord[];

  @OneToMany(() => OperationLog, (l) => l.plan)
  logs: OperationLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
