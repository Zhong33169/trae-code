import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 8107);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3107');

  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ['x-operator-id'],
    allowedHeaders: ['Content-Type', 'x-operator-id', 'x-forwarded-for'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.setGlobalPrefix('');

  await app.listen(port);
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  体育场馆扫码核验场地订单系统 - 后端服务                     ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${port}                           ║
║  API 前缀: http://localhost:${port}/api                       ║
║  CORS 来源: ${corsOrigin}                                    ║
║  启动时间: ${new Date().toLocaleString()}                     ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
