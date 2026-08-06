import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * Infrastructure module (not CRM business logic). It exists so the foundation
 * can be verified end to end: DI, config, Prisma, filters and interceptors.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
