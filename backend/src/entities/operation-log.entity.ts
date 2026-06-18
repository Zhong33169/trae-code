import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { PropagandaPlan } from './propaganda-plan.entity';
import { User } from './user.entity';

@Entity('operation_logs')
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', nullable: true })
  planId: number;

  @ManyToOne(() => PropagandaPlan, (p) => p.logs, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planId' })
  plan: PropagandaPlan;

  @Column({ type: 'integer', nullable: true })
  operatorId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'operatorId' })
  operator: User;

  @Column({ length: 50 })
  action: string;

  @Column({ length: 200 })
  description: string;

  @Column({ type: 'text', nullable: true })
  beforeState: string;

  @Column({ type: 'text', nullable: true })
  afterState: string;

  @CreateDateColumn()
  createdAt: Date;
}
