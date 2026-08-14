import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudentStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateStudentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[6-9][0-9]{9}$/)
  phone?: string;

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

  @ApiPropertyOptional({ description: 'Change enrolled course' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Extended student profile fields (course, fees, zica/zima, etc.)',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ChangeStudentStatusDto {
  @ApiProperty({ enum: StudentStatus })
  @IsEnum(StudentStatus)
  status!: StudentStatus;
}

export class AssignBatchDto {
  @ApiProperty({
    description: 'Batch UUID, or null to unassign',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  batchId!: string | null;
}
