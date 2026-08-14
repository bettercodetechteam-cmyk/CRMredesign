import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.types';

import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth('firebase')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Director/centre analytics overview',
    description:
      'Lead funnel, conversion by staff/course, follow-ups due, student counts, and fee collection.',
  })
  @ApiOkResponse({ description: 'Aggregated CRM analytics' })
  getOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getOverview(user, query);
  }

  @Get('live')
  @ApiOperation({
    summary: 'Realtime dashboard snapshot',
    description:
      'Single round-trip for KPI cards, funnel, follow-ups, today/hot leads, recent students and payments.',
  })
  @ApiOkResponse({ description: 'Live CRM dashboard snapshot' })
  getLive(
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getLive(user, query);
  }
}
