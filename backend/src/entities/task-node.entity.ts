import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PlantingTask } from './planting-task.entity';

export type NodeType = 'registration' | 'audit' | 'review';

export type NodeStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'timeout';

@Entity('task_nodes')
export class TaskNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  taskId: number;

  @Column({
    type: 'text',
  })
  nodeType: NodeType;

  @Column()
  nodeIndex: number;

  @Column()
  nodeName: string;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status: NodeStatus;

  @Column({ type: 'datetime' })
  deadlineAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  startedAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  completedAt: Date;

  @Column({ nullable: true })
  handlerId: number;

  @Column({ nullable: true })
  handlerName: string;

  @Column({ nullable: true, type: 'text' })
  remark: string;

  @Column({ nullable: true, type: 'text' })
  rejectReason: string;

  @Column({ nullable: true, type: 'text' })
  abnormalReason: string;

  @Column({ default: false })
  isTimeout: boolean;

  @Column({ default: 0 })
  timeoutHours: number;

  @ManyToOne(() => PlantingTask, (task) => task.nodes)
  @JoinColumn({ name: 'taskId' })
  task: PlantingTask;

  @CreateDateColumn()
  createdAt: Date;
}
