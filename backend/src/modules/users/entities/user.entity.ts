import { Entity, Column, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Role } from '../../../common/enums/role.enum';
import { ProgressReport } from '../../progress-reports/entities/progress-report.entity';
import { OperationLog } from '../../operation-logs/entities/operation-log.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  username: string;

  @Column()
  name: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ type: 'simple-enum', enum: Role })
  role: Role;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ProgressReport, (report) => report.responsiblePerson)
  responsibleReports: ProgressReport[];

  @OneToMany(() => OperationLog, (log) => log.operator)
  operationLogs: OperationLog[];
}
