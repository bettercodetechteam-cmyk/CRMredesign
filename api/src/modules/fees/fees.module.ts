import { Module } from '@nestjs/common';

import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { ReceiptNumberService } from './receipt-number.service';

@Module({
  controllers: [FeesController],
  providers: [FeesService, ReceiptNumberService],
  exports: [FeesService, ReceiptNumberService],
})
export class FeesModule {}
