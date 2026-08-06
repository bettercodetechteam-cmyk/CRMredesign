import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Directors may filter by centre. Staff are always scoped to their own centre.',
  })
  @IsOptional()
  @IsUUID()
  centreId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive start (ISO datetime). Defaults to 30 days ago.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end (ISO datetime). Defaults to now.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
