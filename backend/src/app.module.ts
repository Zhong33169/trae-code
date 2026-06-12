import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderRepository } from './infrastructure/order.repository';
import { UserRepository } from './infrastructure/user.repository';
import { ScanService } from './application/scan.service';
import { OrderService } from './application/order.service';
import { ScanController } from './interfaces/scan.controller';
import { OrderController } from './interfaces/order.controller';
import { UserController } from './interfaces/user.controller';
import { getDatabase } from './infrastructure/database';

const databaseProvider = {
  provide: 'DATABASE',
  useFactory: async () => getDatabase(),
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [ScanController, OrderController, UserController],
  providers: [databaseProvider, OrderRepository, UserRepository, ScanService, OrderService],
})
export class AppModule {}
