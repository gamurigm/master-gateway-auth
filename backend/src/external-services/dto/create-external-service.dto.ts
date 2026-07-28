import {
  IsOptional,
  IsString,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

const SERVICE_TYPES = ['NATIVE', 'EXTERNAL'] as const;
const AUTH_TYPES = ['JWT', 'API_KEY', 'MTLS', 'OIDC', 'NONE'] as const;

export class CreateExternalServiceDto {
  @Sanitize()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'code debe ser mayusculas, digitos o guion bajo (ej. VENTAS, INVENTARIO_V2)',
  })
  code!: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @IsIn(SERVICE_TYPES, { message: 'type debe ser NATIVE o EXTERNAL' })
  type?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  version?: string;

  @Sanitize()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, {
    message: 'baseUrl debe empezar por http:// o https://',
  })
  baseUrl!: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./]*$/, { message: 'healthPath debe empezar por /' })
  healthPath?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./]*$/, { message: 'metadataEndpoint debe empezar por /' })
  metadataEndpoint?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./]*$/, { message: 'openApiPath debe empezar por /' })
  openApiPath?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @IsIn(AUTH_TYPES, {
    message: 'authenticationType debe ser JWT, API_KEY, MTLS, OIDC o NONE',
  })
  authenticationType?: string;
}
