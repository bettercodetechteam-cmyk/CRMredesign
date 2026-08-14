import { Module } from '@nestjs/common';

import { CrmRecordsController } from './crm-records.controller';
import { CrmRecordsService } from './crm-records.service';

@Module({
  controllers: [CrmRecordsController],
  providers: [CrmRecordsService],
  exports: [CrmRecordsService],
})
export class CrmRecordsModule {}
