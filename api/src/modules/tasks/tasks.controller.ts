import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../auth/auth-user.types';
import { UsersService } from '../users/users.service';

import {
  CreateCommentDto,
  CreateSubtaskDto,
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateCommentDto,
  UpdateSubtaskDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth('firebase')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tasks' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListTasksQueryDto) {
    return this.tasksService.list(user, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Task status counts' })
  stats(@CurrentUser() user: AuthUser) {
    return this.tasksService.stats(user);
  }

  @Get('assignees')
  @ApiOperation({ summary: 'Staff that can be assigned to tasks' })
  assignees(@CurrentUser() user: AuthUser) {
    return this.usersService.listAssignees(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Task detail with comments and activity' })
  getDetail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.getDetail(user, id);
  }

  @Post()
  @Roles(UserRole.director)
  @ApiOperation({ summary: 'Create a task' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.director)
  @ApiOperation({ summary: 'Delete a task' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.remove(user, id);
  }

  @Post(':id/approve')
  @Roles(UserRole.director)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.approve(user, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.director)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.reject(user, id);
  }

  @Post(':id/reopen')
  @Roles(UserRole.director)
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.reopen(user, id);
  }

  @Post(':id/subtasks')
  @Roles(UserRole.director)
  addSubtask(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.tasksService.addSubtask(user, id, dto);
  }

  @Patch(':id/subtasks/:subId')
  @Roles(UserRole.director)
  updateSubtask(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.tasksService.updateSubtask(user, id, subId, dto);
  }

  @Delete(':id/subtasks/:subId')
  @Roles(UserRole.director)
  deleteSubtask(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subId', ParseUUIDPipe) subId: string,
  ) {
    return this.tasksService.deleteSubtask(user, id, subId);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(user, id, dto);
  }

  @Patch(':id/comments/:commentId')
  editComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.tasksService.editComment(user, id, commentId, dto);
  }
}
