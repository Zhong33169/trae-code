import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 8003);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3003');

  app.enableCors({
    origin: corsOrigin.split(',').map(o => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`🚀 后端服务启动在 http://localhost:${port}`);
  console.log(`🌐 CORS 允许来源: ${corsOrigin}`);
}

bootstrap();
