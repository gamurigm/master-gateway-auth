import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateModuleDto {
  @Sanitize()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z_]+$/, {
    message: 'El codigo del modulo solo puede contener mayusculas y guion bajo',
  })
  code!: string;

  @Sanitize()
  @IsString()
  @MaxLength(120)
  name!: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
