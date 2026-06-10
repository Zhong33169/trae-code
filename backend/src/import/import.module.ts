import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from '../entities/import-batch.entity';
import { ImportRecord } from '../entities/import-record.entity';
import { Order } from '../entities/order.entity';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { OrderModule } from '../order/order.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportBatch, ImportRecord, Order]),
    OrderModule,
    AuditModule,
  ],
  providers: [ImportService],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
