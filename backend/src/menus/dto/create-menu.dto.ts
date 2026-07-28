import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
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

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/, {
    message: 'targetUrl debe empezar por http:// o https://',
  })
  targetUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], { each: true })
  methods?: string[];
}
