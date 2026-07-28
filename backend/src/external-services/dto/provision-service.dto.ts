import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export const ALLOWED_PROXY_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

/** Un endpoint del servicio externo que se convertira en un menu hoja. */
export class ProvisionMenuItemDto {
  @Sanitize()
  @IsString()
  @MaxLength(120)
  name!: string;

  /** Ruta visible de la SPA, por ejemplo /app/inventario/productos. */
  @Sanitize()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./:]*$/, {
    message: 'path debe ser una ruta relativa que empiece por /',
  })
  path!: string;

  /** Ruta real dentro del microservicio, por ejemplo /productos. */
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./:]*$/, {
    message: 'targetPath debe ser una ruta relativa que empiece por /',
  })
  targetPath?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(ALLOWED_PROXY_METHODS, { each: true })
  methods?: string[];

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;
}

export class ProvisionServiceDto {
  /** Roles que recibiran acceso al modulo y a los menus generados. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  roleIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProvisionMenuItemDto)
  items!: ProvisionMenuItemDto[];
}
