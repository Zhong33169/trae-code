import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ImportBatch } from './import-batch.entity';
import { Order } from './order.entity';

export enum ImportRecordStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CONFLICT = 'conflict',
  SKIPPED = 'skipped',
}

@Entity('import_records')
export class ImportRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  batchId: string;

  @ManyToOne(() => ImportBatch, batch => batch.records)
  @JoinColumn({ name: 'batchId' })
  batch: ImportBatch;

  @Column({ nullable: true })
  orderId: string;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ default: 0 })
  rowNumber: number;

  @Column({ nullable: true })
  sourceOrderNo: string;

  @Column({
    type: 'simple-enum',
    enum: ImportRecordStatus,
    default: ImportRecordStatus.PENDING,
  })
  status: ImportRecordStatus;

  @Column('text', { nullable: true })
  failReason: string;

  @Column('text', { nullable: true })
  conflictDescription: string;

  @Column('simple-json', { nullable: true })
  rawData: any;

  @Column('simple-json', { nullable: true })
  differences: any;

  @CreateDateColumn()
  createdAt: Date;
}
