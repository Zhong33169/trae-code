import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TreatmentPlanModule } from './treatment-plan/treatment-plan.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    TreatmentPlanModule,
    AuditModule,
  ],
})
export class AppModule {}
