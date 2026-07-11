import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

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
}
