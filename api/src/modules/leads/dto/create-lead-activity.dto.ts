import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLeadActivityDto {
  @ApiProperty({ example: 'call', description: 'call | visit | note | whatsapp | other' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  activityType!: string;

  @ApiProperty({ example: 'Spoke with parent about Animation course' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  summary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;
}
