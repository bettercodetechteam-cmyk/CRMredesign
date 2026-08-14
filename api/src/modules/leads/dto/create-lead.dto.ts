import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, LeadStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function normalizePhoneInput(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeFirstNameInput(value: unknown): string {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length >= 2) return trimmed;
  if (trimmed.length === 1) return `${trimmed}.`;
  return trimmed;
}

export class CreateLeadDto {
  @ApiProperty({ example: 'Riya' })
  @Transform(({ value }) => normalizeFirstNameInput(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty({ example: '9876543210', description: 'Indian 10-digit mobile' })
  @Transform(({ value }) => normalizePhoneInput(value))
  @IsString()
  @Matches(/^[6-9][0-9]{9}$/, {
    message: 'phone must be a valid 10-digit Indian mobile number',
  })
  phone!: string;

  @ApiPropertyOptional({ example: 'riya@example.com' })
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed === '' ? undefined : trimmed.toLowerCase();
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiProperty({ enum: LeadSource })
  @IsEnum(LeadSource)
  source!: LeadSource;

  @ApiPropertyOptional({
    description: 'Centre UUID. Directors may set any; staff default to their own centre.',
  })
  @IsOptional()
  @IsUUID()
  centreId?: string;

  @ApiPropertyOptional({ description: 'Staff user UUID to assign' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Course UUID the lead is interested in' })
  @IsOptional()
  @IsUUID()
  courseInterestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'ISO datetime for next follow-up' })
  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;

  @ApiPropertyOptional({ enum: LeadStatus, default: LeadStatus.new })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
