import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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

import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import {
  ListFeePlansQueryDto,
  ListReceiptsQueryDto,
} from './dto/list-fees-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { FeesService } from './fees.service';

@ApiTags('fees')
@ApiBearerAuth('firebase')
@Controller('fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Post('plans')
  @ApiOperation({ summary: 'Create a fee plan with installments for a student' })
  @ApiCreatedResponse({ description: 'Fee plan created' })
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreateFeePlanDto) {
    return this.feesService.createPlan(user, dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List fee plans' })
  @ApiOkResponse({ description: 'Paginated fee plans' })
  listPlans(@CurrentUser() user: AuthUser, @Query() query: ListFeePlansQueryDto) {
    return this.feesService.listPlans(user, query);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get fee plan with installments and payments' })
  getPlan(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feesService.getPlan(user, id);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Record a payment and issue a receipt',
    description:
      'Allocates receipt number RCP-{CENTRE}-{YYMM}-{SEQ} inside the same transaction.',
  })
  @ApiCreatedResponse({ description: 'Payment recorded with receipt' })
  recordPayment(@CurrentUser() user: AuthUser, @Body() dto: RecordPaymentDto) {
    return this.feesService.recordPayment(user, dto);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List receipts' })
  listReceipts(
    @CurrentUser() user: AuthUser,
    @Query() query: ListReceiptsQueryDto,
  ) {
    return this.feesService.listReceipts(user, query);
  }

  @Get('receipts/by-number/:receiptNo')
  @ApiOperation({ summary: 'Get receipt by receipt number' })
  getReceiptByNumber(
    @CurrentUser() user: AuthUser,
    @Param('receiptNo') receiptNo: string,
  ) {
    return this.feesService.getReceiptByNumber(user, receiptNo);
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get receipt by id' })
  getReceipt(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feesService.getReceipt(user, id);
  }
}
