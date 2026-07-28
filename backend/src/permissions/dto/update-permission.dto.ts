import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  resource?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  delegable?: boolean;
}
