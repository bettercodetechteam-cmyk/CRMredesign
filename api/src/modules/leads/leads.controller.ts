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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.types';
import { ConvertLeadDto } from '../students/dto/convert-lead.dto';
import { StudentsService } from '../students/students.service';

import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { ChangeLeadStatusDto, UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth('firebase')
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly studentsService: StudentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a lead' })
  @ApiCreatedResponse({ description: 'Lead created' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List leads with filters',
    description:
      'Staff are scoped to their centre. Directors may pass centreId or see all centres.',
  })
  @ApiOkResponse({ description: 'Paginated lead list' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead detail with recent history and activities' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadsService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead fields (not status — use status endpoint)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(user, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change lead status',
    description:
      'Writes lead_status_history. To convert a lead, use POST /leads/:id/convert.',
  })
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLeadStatusDto,
  ) {
    return this.leadsService.changeStatus(user, id, dto);
  }

  @Post(':id/convert')
  @ApiOperation({
    summary: 'Convert lead → student (allocates roll number)',
    description:
      'Transaction: allocate roll (PREFIX-YYMM-START-END-SEQ), create student, mark lead converted.',
  })
  @ApiCreatedResponse({ description: 'Student created from lead' })
  convert(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.studentsService.convertFromLead(user, id, dto);
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Add a lead activity (call, visit, note, …)' })
  @ApiCreatedResponse({ description: 'Activity recorded' })
  addActivity(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadActivityDto,
  ) {
    return this.leadsService.addActivity(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a lead',
    description: 'Cannot delete converted leads. Related history and activities are removed.',
  })
  @ApiOkResponse({ description: 'Lead deleted' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadsService.remove(user, id);
  }
}
