import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

/**
 * El `code` no es actualizable a proposito: identifica al modulo generado por
 * `provision`, asi que cambiarlo dejaria ese modulo huerfano.
 */
export class UpdateExternalServiceDto {
  @Sanitize()
  @IsOptional()
  @IsString()
  @MinLength(2)
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
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, {
    message: 'baseUrl debe empezar por http:// o https://',
  })
  baseUrl?: string;

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
