import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class ProbeServiceDto {
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
  @Matches(/^\/[\w\-./]*$/, {
    message: 'healthPath debe ser una ruta relativa que empiece por /',
  })
  healthPath?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./]*$/, {
    message: 'openApiPath debe ser una ruta relativa que empiece por /',
  })
  openApiPath?: string;
}
