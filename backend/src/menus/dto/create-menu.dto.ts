import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

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
}
