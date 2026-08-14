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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth-user.types';

import { CrmRecordsService } from './crm-records.service';

@ApiTags('crm-records')
@ApiBearerAuth('firebase')
@UsePipes(
  new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: false,
  }),
)
@Controller('crm-records')
export class CrmRecordsController {
  constructor(private readonly crmRecords: CrmRecordsService) {}

  @Get('fees')
  @ApiOperation({ summary: 'List fee records (legacy CRM document store)' })
  listFees(
    @CurrentUser() user: AuthUser,
    @Query('centreId') centreId?: string,
  ) {
    return this.crmRecords.listFeeRecords(user, centreId);
  }

  @Get('fees/:id')
  @ApiOperation({ summary: 'Get a single fee record by id' })
  getFee(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crmRecords.getFeeRecord(user, id);
  }

  @Post('fees')
  createFee(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.crmRecords.createFeeRecord(user, body);
  }

  @Patch('fees/:id')
  updateFee(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.crmRecords.updateFeeRecord(user, id, body);
  }

  @Delete('fees/:id')
  deleteFee(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crmRecords.deleteFeeRecord(user, id);
  }

  @Get('gst')
  listGst(
    @CurrentUser() user: AuthUser,
    @Query('centreId') centreId?: string,
  ) {
    return this.crmRecords.listGstRecords(user, centreId);
  }

  @Post('gst')
  createGst(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.crmRecords.createGstRecord(user, body);
  }

  @Patch('gst/:id')
  updateGst(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.crmRecords.updateGstRecord(user, id, body);
  }

  @Delete('gst/:id')
  deleteGst(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crmRecords.deleteGstRecord(user, id);
  }

  @Get('custom-courses')
  listCustomCourses(
    @CurrentUser() user: AuthUser,
    @Query('centreId') centreId?: string,
  ) {
    return this.crmRecords.listCustomCourses(user, centreId);
  }

  @Post('custom-courses')
  createCustomCourse(
    @CurrentUser() user: AuthUser,
    @Body() body: { courseName: string; centreId?: string },
  ) {
    return this.crmRecords.createCustomCourse(
      user,
      body.courseName,
      body.centreId,
    );
  }
}
