import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class UpdateModuleDto {
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z_]+$/, {
    message: 'El codigo del modulo solo puede contener mayusculas y guion bajo',
  })
  code?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
