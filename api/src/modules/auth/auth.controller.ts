import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AllowPending } from '../../common/decorators/allow-pending.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { AuthUser } from './auth-user.types';

@ApiTags('auth')
@ApiBearerAuth('firebase')
@Controller('auth')
export class AuthController {
  @Get('me')
  @AllowPending()
  @ApiOperation({
    summary: 'Return the authenticated CRM user (Firebase token → Postgres profile)',
  })
  @ApiOkResponse({ description: 'Current staff profile from PostgreSQL.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Firebase ID token.' })
  getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
