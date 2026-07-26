import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

/** Un endpoint del servicio externo que se convertira en un menu hoja. */
export class ProvisionMenuItemDto {
  @Sanitize()
  @IsString()
  @MaxLength(120)
  name!: string;

  @Sanitize()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/[\w\-./:]*$/, { message: 'path debe ser una ruta relativa que empiece por /' })
  path!: string;

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
