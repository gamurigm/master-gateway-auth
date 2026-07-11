import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class UpdateUserDto {
  @Sanitize()
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'La contrasena debe tener al menos 8 caracteres, mayuscula, minuscula y numero',
  })
  password?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
