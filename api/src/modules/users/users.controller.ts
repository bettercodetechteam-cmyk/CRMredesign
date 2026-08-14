import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../auth/auth-user.types';

import {
  ApproveUserDto,
  ListUsersQueryDto,
  UpdateUserAccessDto,
} from './dto/user-access.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('firebase')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.director)
  @ApiOperation({ summary: 'List CRM staff users (director)' })
  @ApiOkResponse({ description: 'Paginated staff list' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(user, query);
  }

  @Get('assignees')
  @ApiOperation({ summary: 'List assignable staff for tasks' })
  listAssignees(@CurrentUser() user: AuthUser) {
    return this.usersService.listAssignees(user);
  }

  @Patch(':id/access')
  @Roles(UserRole.director)
  @ApiOperation({ summary: 'Update role and module permissions' })
  updateAccess(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserAccessDto,
  ) {
    return this.usersService.updateAccess(user, id, dto);
  }

  @Post(':id/approve')
  @Roles(UserRole.director)
  @ApiOperation({ summary: 'Approve a pending user and assign a role' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveUserDto,
  ) {
    return this.usersService.approve(user, id, dto);
  }

  @Post(':id/reject')
  @Roles(UserRole.director)
  @ApiOperation({ summary: 'Reject / deactivate a pending user' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.reject(user, id);
  }
}
