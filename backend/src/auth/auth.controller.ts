import { Body, Controller, Headers, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('auth/select-role')
  selectRole(@Body() dto: SelectRoleDto) {
    return this.authService.selectRole(dto);
  }

  @Post('auth/refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/logout')
  logout(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: RefreshTokenDto) {
    if (!user) {
      throw new UnauthorizedException('Token requerido');
    }

    return this.authService.logout(user.sub, dto.refreshToken);
  }

  @Post('internals/validate-token')
  validateToken(@Headers('x-internal-api-key') apiKey: string | undefined, @Body() dto: ValidateTokenDto) {
    return this.authService.validateInternal(apiKey, dto.token);
  }
}

