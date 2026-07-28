import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';
import { PROXY_HTTP_METHODS } from './proxy-route.constants';

export class CreateMenuDto {
  @Sanitize()
  @IsString()
  @MaxLength(120)
  name!: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  url?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order = 0;

  @IsUUID('4')
  moduleId!: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  /**
   * URL del endpoint real en el microservicio destino.
   *
   * Si se indica, el Master crea la `ExternalServiceRoute` necesaria para que
   * `/api/proxy/...` sepa a donde redirigir, sin pasar por el modulo External
   * Services. Si se omite, el menu es solo navegacion (comportamiento actual).
   */
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, {
    message: 'targetUrl debe ser una URL http(s) absoluta',
  })
  targetUrl?: string;

  /** Metodos HTTP que la ruta expone. Por defecto `['GET']`. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PROXY_HTTP_METHODS, { each: true })
  methods?: string[];
}
