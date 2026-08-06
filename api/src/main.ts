import 'reflect-metadata';

import { Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { NodeEnv } from './config/env.validation';
import { GLOBAL_PREFIX, SWAGGER_PATH, setupSwagger } from './config/swagger.config';

function resolveLogLevels(): LogLevel[] {
  return process.env.NODE_ENV === NodeEnv.Production
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug', 'verbose'];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: resolveLogLevels(),
  });

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  const port = configService.get<number>('app.port', 3000);
  const nodeEnv = configService.get<NodeEnv>('app.nodeEnv', NodeEnv.Development);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  const swaggerEnabled = configService.get<boolean>('app.swaggerEnabled', true);

  app.setGlobalPrefix(GLOBAL_PREFIX);

  app.enableCors({
    // An empty allow-list means "reflect the request origin", which is only
    // acceptable locally — always set CORS_ORIGINS in production.
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  if (swaggerEnabled) {
    setupSwagger(app);
  }

  // Lets Nest run onModuleDestroy hooks (Prisma disconnect) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`API listening on http://localhost:${port}/${GLOBAL_PREFIX}`);

  if (swaggerEnabled) {
    logger.log(`Swagger UI on http://localhost:${port}/${SWAGGER_PATH}`);
  }
}

void bootstrap();
