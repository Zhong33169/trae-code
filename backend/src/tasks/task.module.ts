import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { AuthModule } from '../auth/auth.module';
import { PlantingTask } from '../entities/planting-task.entity';
import { TaskNode } from '../entities/task-node.entity';
import { OperationLog } from '../entities/operation-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlantingTask, TaskNode, OperationLog]),
    AuthModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
