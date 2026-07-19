import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateRoleDto {
  @Sanitize()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z_]+$/, {
    message: 'El nombre del rol solo puede contener mayusculas y guion bajo',
  })
  name!: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
