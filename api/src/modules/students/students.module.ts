import { Module } from '@nestjs/common';

import { RollNumberService } from './roll-number.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, RollNumberService],
  exports: [StudentsService, RollNumberService],
})
export class StudentsModule {}
