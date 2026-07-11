import { IsEmail, IsString, MinLength } from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class LoginDto {
  @Sanitize()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
