import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { KeysService } from '../common/keys/keys.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly keysService: KeysService,
  ) {}

  @Get('auth/public-key')
  getPublicKey() {
    return {
      algorithm: 'RS256',
      publicKey: this.keysService.getPublicKey(),
    };
  }

  @Get('.well-known/jwks.json')
  async getJwks() {
    return this.keysService.getJwks();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 300_000 } })
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 120_000 } })
  @Post('auth/select-role')
  selectRole(@Body() dto: SelectRoleDto) {
    return this.authService.selectRole(dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000, blockDuration: 120_000 } })
  @Post('auth/refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/logout')
  logout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: RefreshTokenDto,
  ) {
    if (!user) {
      throw new UnauthorizedException('Token requerido');
    }

    return this.authService.logout(user.sub, dto.refreshToken);
  }

  @Post('internals/validate-token')
  validateToken(
    @Headers('x-internal-api-key') apiKey: string | undefined,
    @Headers('x-internal-service') serviceName: string | undefined,
    @Body() dto: ValidateTokenDto,
  ) {
    return this.authService.validateInternal(apiKey, dto.token, serviceName);
  }
}
