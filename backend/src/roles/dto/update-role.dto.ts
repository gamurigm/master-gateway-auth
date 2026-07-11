import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class UpdateRoleDto {
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z_]+$/, {
    message: 'El nombre del rol solo puede contener mayusculas y guion bajo',
  })
  name?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
