import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TaskNode } from './task-node.entity';
import { OperationLog } from './operation-log.entity';

export type TaskStatus =
  | 'pending_registration'
  | 'registered'
  | 'audit_rejected'
  | 'audit_passed'
  | 'review_rejected'
  | 'archived';

export type CropType = 'rice' | 'wheat' | 'corn' | 'soybean' | 'vegetable' | 'fruit' | 'other';

@Entity('planting_tasks')
export class PlantingTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  taskNo: string;

  @Column()
  taskName: string;

  @Column({
    type: 'text',
    default: 'other',
  })
  cropType: CropType;

  @Column({ type: 'real' })
  plantingArea: number;

  @Column()
  location: string;

  @Column()
  planterName: string;

  @Column()
  planterPhone: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({
    type: 'text',
    default: 'pending_registration',
  })
  status: TaskStatus;

  @Column({ default: 0 })
  currentNodeIndex: number;

  @Column({ nullable: true })
  registeredById: number;

  @Column({ nullable: true })
  registeredByName: string;

  @Column({ nullable: true })
  auditorId: number;

  @Column({ nullable: true })
  auditorName: string;

  @Column({ nullable: true })
  reviewerId: number;

  @Column({ nullable: true })
  reviewerName: string;

  @Column({ nullable: true, type: 'datetime' })
  registeredAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  auditAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  reviewAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  archivedAt: Date;

  @Column({ default: false })
  hasTimeout: boolean;

  @Column({ default: 0 })
  timeoutNodeIndex: number;

  @OneToMany(() => TaskNode, (node) => node.task)
  nodes: TaskNode[];

  @OneToMany(() => OperationLog, (log) => log.task)
  operationLogs: OperationLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
