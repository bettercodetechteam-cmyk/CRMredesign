import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInstallmentDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  sequence!: number;

  @ApiProperty({ example: 'Admission' })
  @IsString()
  @MaxLength(80)
  label!: string;

  @ApiProperty({ example: 15000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountDue!: number;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateFeePlanDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: 45000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [CreateInstallmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInstallmentDto)
  installments!: CreateInstallmentDto[];
}
