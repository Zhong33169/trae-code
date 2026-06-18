import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProgressReportsModule } from './modules/progress-reports/progress-reports.module';
import { WeeklyReportsModule } from './modules/weekly-reports/weekly-reports.module';
import { DeviationAnalysisModule } from './modules/deviation-analysis/deviation-analysis.module';
import { OwnerReportsModule } from './modules/owner-reports/owner-reports.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { OperationLogsModule } from './modules/operation-logs/operation-logs.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_DATABASE || './data/progress.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
    }),
    AuthModule,
    UsersModule,
    ProgressReportsModule,
    WeeklyReportsModule,
    DeviationAnalysisModule,
    OwnerReportsModule,
    StatisticsModule,
    OperationLogsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
