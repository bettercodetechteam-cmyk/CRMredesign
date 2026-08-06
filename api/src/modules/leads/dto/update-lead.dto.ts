import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(
  OmitType(CreateLeadDto, ['status'] as const),
) {
  @ApiPropertyOptional({
    description: 'Optimistic lock version from the last read',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;
}

export class ChangeLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @ApiPropertyOptional({ description: 'Required when status is lost' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
