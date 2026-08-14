import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ description: 'Course UUID for roll number allocation' })
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional({ description: 'Centre UUID (directors only; defaults to your centre)' })
  @IsOptional()
  @IsUUID()
  centreId?: string;

  @ApiPropertyOptional({ description: 'Optional batch at the student centre' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({
    description: 'Admission date (ISO date). Defaults to today (UTC).',
    example: '2026-07-15',
  })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty()
  @Matches(/^[6-9][0-9]{9}$/)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  parentName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Matches(/^[6-9][0-9]{9}$/)
  parentPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: 'Extended student profile fields (course, fees, zica/zima, etc.)',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
