import {
  Body,
  Controller,
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

import { BatchesService } from './batches.service';
import { CreateBatchDto, UpdateBatchDto } from './dto/create-batch.dto';
import { ListBatchesQueryDto } from './dto/list-batches-query.dto';

@ApiTags('batches')
@ApiBearerAuth('firebase')
@Controller('batches')
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a batch' })
  @ApiCreatedResponse({ description: 'Batch created' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBatchDto) {
    return this.batchesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List batches with filters' })
  @ApiOkResponse({ description: 'Paginated batch list' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListBatchesQueryDto) {
    return this.batchesService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get batch detail (includes enrolled student count)' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.batchesService.findOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update batch details or status' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBatchDto,
  ) {
    return this.batchesService.update(user, id, dto);
  }
}
