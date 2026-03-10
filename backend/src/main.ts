import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { parseCorsOrigins } from './common/cors-origins';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const origins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Habilita shutdown correto do Nest (Prisma desconecta via onModuleDestroy)
  app.enableShutdownHooks();

  await app.listen(3000);
}

// Evita erro do ESLint "no-floating-promises"
bootstrap().catch((err) => {
  console.error('❌ Erro ao iniciar aplicação:', err);
  process.exit(1);
});
