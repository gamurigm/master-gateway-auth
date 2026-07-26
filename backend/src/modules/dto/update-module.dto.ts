import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class UpdateModuleDto {
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z_]+$/, {
    message: 'El codigo del modulo solo puede contener mayusculas y guion bajo',
  })
  code?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(512)
  baseUrl?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_-]+$/, {
    message:
      'El serviceName solo puede contener minusculas, numeros, guion medio y guion bajo',
  })
  serviceName?: string;
}
