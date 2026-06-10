import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Order } from './order.entity';
import { AuditLog } from './audit-log.entity';

export enum UserRole {
  REGISTRAR = 'registrar',
  SUPERVISOR = 'supervisor',
  REVIEWER = 'reviewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ nullable: true })
  department: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Order, order => order.createdBy)
  orders: Order[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
