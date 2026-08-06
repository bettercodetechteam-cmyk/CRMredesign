import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

import { HealthService, LivenessResult, ReadinessResult } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe — is the process running?' })
  @ApiOkResponse({ description: 'Service is up.' })
  getLiveness(): LivenessResult {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — can the service reach PostgreSQL?' })
  @ApiOkResponse({ description: 'Service and its dependencies are ready.' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable.' })
  async getReadiness(): Promise<ReadinessResult> {
    const result = await this.healthService.getReadiness();

    // Return a real 503 so load balancers and orchestrators react correctly.
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException({
        message: 'Service is not ready',
        details: result,
      });
    }

    return result;
  }
}
