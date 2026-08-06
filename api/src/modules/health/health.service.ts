import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NodeEnv } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

export interface LivenessResult {
  status: 'ok';
  service: string;
  environment: NodeEnv;
  uptimeSeconds: number;
  timestamp: string;
}

export interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface ReadinessResult {
  status: 'ok' | 'degraded';
  database: DependencyStatus;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness(): LivenessResult {
    return {
      status: 'ok',
      service: 'zica-crm-api',
      environment:
        this.configService.get<NodeEnv>('app.nodeEnv') ?? NodeEnv.Development,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
