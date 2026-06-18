import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plan/plan.module';
import { User } from './entities/user.entity';
import { PropagandaPlan } from './entities/propaganda-plan.entity';
import { HandoverRecord } from './entities/handover-record.entity';
import { OperationLog } from './entities/operation-log.entity';
import { TransformInterceptor, AllExceptionsFilter } from './common/response';
import { SeedService } from './seed';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: join(process.cwd(), 'propaganda.db'),
      entities: [User, PropagandaPlan, HandoverRecord, OperationLog],
      synchronize: true,
      logging: false,
    }),
    TypeOrmModule.forFeature([User, PropagandaPlan, HandoverRecord, OperationLog]),
    AuthModule,
    PlanModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    SeedService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly seed: SeedService) {}
  async onModuleInit() {
    await this.seed.run();
  }
}
