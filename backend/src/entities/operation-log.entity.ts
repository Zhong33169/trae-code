import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PlantingTask } from './planting-task.entity';

export type OperationType =
  | 'create'
  | 'register'
  | 'correct'
  | 'audit_pass'
  | 'audit_reject'
  | 'review_pass'
  | 'review_reject'
  | 'archive'
  | 'timeout_warning';

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  taskId: number;

  @Column({ nullable: true })
  operatorId: number;

  @Column({ nullable: true })
  operatorName: string;

  @Column({
    type: 'text',
  })
  operationType: OperationType;

  @Column()
  operationName: string;

  @Column({ nullable: true, type: 'text' })
  detail: string;

  @Column({ nullable: true, type: 'text' })
  abnormalReason: string;

  @ManyToOne(() => PlantingTask, (task) => task.operationLogs)
  @JoinColumn({ name: 'taskId' })
  task: PlantingTask;

  @CreateDateColumn()
  createdAt: Date;
}
