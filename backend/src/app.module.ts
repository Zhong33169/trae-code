import { Module, OnModuleInit } from '@nestjs/common';
import { InvitationModule } from './invitation/invitation.module';
import { AuditModule } from './audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { seed } from './database/seed';
import { Inject } from '@nestjs/common';
import Database from 'better-sqlite3';

@Module({
  imports: [DatabaseModule, InvitationModule, AuditModule],
})
export class AppModule implements OnModuleInit {
  constructor(@Inject('DATABASE') private db: Database.Database) {}

  onModuleInit() {
    seed(this.db);
  }
}
