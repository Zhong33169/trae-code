import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { OrderItem } from './order-item.entity';
import { Attachment } from './attachment.entity';
import { AuditLog } from './audit-log.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  PENDING_FINAL_REVIEW = 'pending_final_review',
  FINAL_APPROVED = 'final_approved',
  FINAL_REJECTED = 'final_rejected',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  SIGNED = 'signed',
  ARCHIVED = 'archived',
  EXCEPTION = 'exception',
  MATERIALS_MISSING = 'materials_missing',
  TIMEOUT = 'timeout',
  RETURNED = 'returned',
}

export enum OrderSource {
  ONLINE = 'online',
  OFFLINE_IMPORT = 'offline_import',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNo: string;

  @Column()
  communityName: string;

  @Column({ nullable: true })
  contactName: string;

  @Column({ nullable: true })
  contactPhone: string;

  @Column({ nullable: true })
  deliveryAddress: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ default: 0 })
  totalQuantity: number;

  @Column({
    type: 'simple-enum',
    enum: OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  @Column({
    type: 'simple-enum',
    enum: OrderSource,
    default: OrderSource.ONLINE,
  })
  source: OrderSource;

  @Column('text', { nullable: true })
  remark: string;

  @Column('text', { nullable: true })
  rejectReason: string;

  @Column('text', { nullable: true })
  auditRemark: string;

  @Column({ nullable: true })
  signedAt: Date;

  @Column({ nullable: true })
  expectedDeliveryDate: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User;

  @Column({ nullable: true })
  reviewedById: string;

  @Column({ nullable: true })
  reviewedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'finalReviewedById' })
  finalReviewedBy: User;

  @Column({ nullable: true })
  finalReviewedById: string;

  @Column({ nullable: true })
  finalReviewedAt: Date;

  @Column({ nullable: true })
  importBatchId: string;

  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Attachment, attachment => attachment.order, { cascade: true })
  attachments: Attachment[];

  @OneToMany(() => AuditLog, auditLog => auditLog.order)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
