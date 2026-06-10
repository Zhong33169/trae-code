import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { ImportRecord } from './import-record.entity';
import { Attachment } from './attachment.entity';

export enum ImportBatchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PARTIAL_SUCCESS = 'partial_success',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum ImportSource {
  EXCEL = 'excel',
  CSV = 'csv',
  MANUAL = 'manual',
}

@Entity('import_batches')
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  batchNo: string;

  @Column({
    type: 'simple-enum',
    enum: ImportSource,
    default: ImportSource.EXCEL,
  })
  source: ImportSource;

  @Column({
    type: 'simple-enum',
    enum: ImportBatchStatus,
    default: ImportBatchStatus.PENDING,
  })
  status: ImportBatchStatus;

  @Column()
  filename: string;

  @Column({ default: 0 })
  totalRecords: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failedCount: number;

  @Column({ default: 0 })
  conflictCount: number;

  @Column({ default: 0 })
  skippedCount: number;

  @Column('text', { nullable: true })
  remark: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'importedById' })
  importedBy: User;

  @Column()
  importedById: string;

  @OneToMany(() => ImportRecord, record => record.batch, { cascade: true })
  records: ImportRecord[];

  @OneToMany(() => Attachment, attachment => attachment.importBatch, { cascade: true })
  attachments: Attachment[];

  @CreateDateColumn()
  createdAt: Date;
}
