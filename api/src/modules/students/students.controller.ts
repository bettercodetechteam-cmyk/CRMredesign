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
import { StudentStatus } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.types';

import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import {
  AssignBatchDto,
  ChangeStudentStatusDto,
  UpdateStudentDto,
} from './dto/update-student.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth('firebase')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new student (direct admission)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List students with filters' })
  @ApiOkResponse({ description: 'Paginated student list' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListStudentsQueryDto) {
    return this.studentsService.findAll(user, query);
  }

  @Get('by-roll/:rollNo')
  @ApiOperation({ summary: 'Get student by roll number' })
  findByRollNo(
    @CurrentUser() user: AuthUser,
    @Param('rollNo') rollNo: string,
  ) {
    return this.studentsService.findByRollNo(user, rollNo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student by id' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studentsService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update student profile fields' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(user, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change student status (active / graduated / dropped / …)' })
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStudentStatusDto,
  ) {
    return this.studentsService.changeStatus(user, id, dto);
  }

  @Patch(':id/batch')
  @ApiOperation({
    summary: 'Assign or unassign a batch',
    description: 'Batch must match the student centre and course. Pass batchId: null to unassign.',
  })
  assignBatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBatchDto,
  ) {
    return this.studentsService.assignBatch(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Drop student (soft delete — sets status to dropped)' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studentsService.changeStatus(user, id, { status: StudentStatus.dropped });
  }
}
