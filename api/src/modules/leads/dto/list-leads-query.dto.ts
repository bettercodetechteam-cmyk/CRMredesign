import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, LeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListLeadsQueryDto {
  @ApiPropertyOptional({ description: 'Directors only — filter by centre' })
  @IsOptional()
  @IsUUID()
  centreId?: string;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseInterestId?: string;

  @ApiPropertyOptional({ description: 'Search first/last name, phone, email, leadNo' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Follow-ups due on or before this ISO date' })
  @IsOptional()
  @IsString()
  followUpBefore?: string;

  @ApiPropertyOptional({ description: 'Created on/after ISO datetime' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Created on/before ISO datetime' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    description: 'If true, only leads assigned to the current user',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mineOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
