import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = parseInt(process.env.BACKEND_PORT || '8003');
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3003';

  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-User-Id', 'X-Requested-With', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  await app.listen(port);
  console.log(`Backend server is running on http://localhost:${port}`);
}

bootstrap();
