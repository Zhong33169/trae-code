import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Order } from './order.entity';
import { ImportBatch } from './import-batch.entity';

export enum AttachmentType {
  PROOF = 'proof',
  RECEIPT = 'receipt',
  MATERIAL = 'material',
  OTHER = 'other',
}

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  orderId: string;

  @ManyToOne(() => Order, order => order.attachments, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  importBatchId: string;

  @ManyToOne(() => ImportBatch, batch => batch.attachments, { nullable: true })
  @JoinColumn({ name: 'importBatchId' })
  importBatch: ImportBatch;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ default: 0 })
  size: number;

  @Column({
    type: 'simple-enum',
    enum: AttachmentType,
    default: AttachmentType.OTHER,
  })
  type: AttachmentType;

  @Column({ nullable: true })
  uploadedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
