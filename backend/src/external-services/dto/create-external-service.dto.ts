import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateExternalServiceDto {
  @Sanitize()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'code debe ser mayusculas, digitos o guion bajo (ej. VENTAS, INVENTARIO_V2)',
  })
  code!: string;

  @Sanitize()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

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
  @Matches(/^\/[\w\-./]*$/, { message: 'openApiPath debe empezar por /' })
  openApiPath?: string;
}
