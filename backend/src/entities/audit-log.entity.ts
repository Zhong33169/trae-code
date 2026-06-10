import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Order } from './order.entity';
import { User } from './user.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  SUBMIT = 'submit',
  REVIEW_APPROVE = 'review_approve',
  REVIEW_REJECT = 'review_reject',
  FINAL_APPROVE = 'final_approve',
  FINAL_REJECT = 'final_reject',
  SHIP = 'ship',
  DELIVER = 'deliver',
  SIGN = 'sign',
  ARCHIVE = 'archive',
  RETURN = 'return',
  RECTIFY = 'rectify',
  IMPORT = 'import',
  EXCEPTION = 'exception',
  DELETE = 'delete',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  orderId: string;

  @ManyToOne(() => Order, order => order.auditLogs, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, user => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'simple-enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column('text', { nullable: true })
  description: string;

  @Column('simple-json', { nullable: true })
  beforeData: any;

  @Column('simple-json', { nullable: true })
  afterData: any;

  @Column('text', { nullable: true })
  failReason: string;

  @Column({ default: true })
  success: boolean;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
