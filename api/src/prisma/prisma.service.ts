import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { NodeEnv } from '../config/env.validation';

/**
 * Single Prisma connection for the whole application.
 *
 * Prisma 7 no longer reads the connection URL from `schema.prisma`, so the URL
 * is injected here through the `pg` driver adapter using validated config.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.getOrThrow<string>('database.url'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();

      // The pg driver adapter connects lazily, so issue a trivial query to
      // prove the database is really reachable at startup.
      await this.$queryRaw`SELECT 1`;

      this.logger.log('Connected to PostgreSQL');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      // Fail fast in production; in development let the app boot so routes and
      // Swagger stay usable before Postgres is running locally.
      if (this.configService.get<NodeEnv>('app.nodeEnv') === NodeEnv.Production) {
        throw error;
      }

      this.logger.warn(`PostgreSQL unavailable, continuing anyway: ${reason}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }
}
