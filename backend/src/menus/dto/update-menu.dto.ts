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

export class UpdateMenuDto {
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  url?: string | null;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsUUID('4')
  moduleId?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  /**
   * URL destino del microservicio.
   *
   * `null` (o cadena vacia) desactiva la ruta de proxy del menu; `undefined`
   * la deja como esta. `@IsOptional()` de class-validator omite la validacion
   * tanto para `undefined` como para `null`, que es justo lo que hace falta
   * para poder limpiar el campo.
   */
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/.+)?$/i, {
    message: 'targetUrl debe ser una URL http(s) absoluta o quedar vacia',
  })
  targetUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PROXY_HTTP_METHODS, { each: true })
  methods?: string[];
}
