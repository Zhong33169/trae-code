import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Shift } from '../common/constants';
import { PropagandaPlan } from './propaganda-plan.entity';
import { User } from './user.entity';

@Entity('handover_records')
export class HandoverRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  planId: number;

  @ManyToOne(() => PropagandaPlan, (p) => p.handovers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planId' })
  plan: PropagandaPlan;

  @Column({ type: 'integer' })
  handFromId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'handFromId' })
  handFrom: User;

  @Column({ type: 'integer' })
  handToId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'handToId' })
  handTo: User;

  @Column({ type: 'simple-enum', enum: Shift })
  fromShift: Shift;

  @Column({ type: 'simple-enum', enum: Shift })
  toShift: Shift;

  @Column({ type: 'datetime' })
  confirmTime: Date;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}
