import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropagandaPlan } from '../entities/propaganda-plan.entity';
import { HandoverRecord } from '../entities/handover-record.entity';
import { OperationLog } from '../entities/operation-log.entity';
import { User } from '../entities/user.entity';
import { PlanService } from './plan.service';
import { PlanController } from './plan.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropagandaPlan, HandoverRecord, OperationLog, User]),
    AuthModule,
  ],
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlanModule {}
