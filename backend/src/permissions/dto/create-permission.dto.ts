import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z]+:[a-z_]+$/, {
    message: 'code must be in format "resource:action" (e.g. users:read)',
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  resource!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  delegable?: boolean;
}
