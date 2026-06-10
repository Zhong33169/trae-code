import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: path.resolve(__dirname, '../../data/app.db'),
  entities: [__dirname + '/../entities/**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
};
