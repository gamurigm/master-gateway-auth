import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { omitPassword } from '../common/utils/omit-password';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SelectRoleDto } from './dto/select-role.dto';

type TempTokenPayload = {
  sub: string;
  email: string;
};

type GatewayTokenPayload = {
  sub: string;
  roleId: string;
  roleName?: string;
  jti: string;
};

type DecodedJwt = {
  exp?: number;
};

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;
type JwtClaims = {
  audience: string;
  issuer: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, estado: Estado.ACTIVO },
      include: {
        roles: {
          where: { estado: Estado.ACTIVO, role: { estado: Estado.ACTIVO } },
          include: { role: true },
        },
      },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.failed',
          emailHash: this.hashIdentifier(dto.email),
        }),
      );
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const roles = user.roles.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
      description: assignment.role.description,
    }));

    const tempToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email } satisfies TempTokenPayload,
      {
        secret:
          this.configService.get<string>('TEMP_JWT_SECRET') ??
          'change-me-temp-secret',
        expiresIn: this.jwtExpiresIn('TEMP_JWT_EXPIRES_IN', '5m'),
        ...this.jwtSignClaims(),
      },
    );

    this.logger.log(
      JSON.stringify({
        event: 'auth.login.success',
        userId: user.id,
        roles: roles.length,
      }),
    );

    return {
      tempToken,
      user: omitPassword(user),
      roles,
    };
  }

  async selectRole(dto: SelectRoleDto) {
    const payload = await this.verifyTempToken(dto.tempToken);
    const assignment = await this.prisma.userRole.findFirst({
      where: {
        userId: payload.sub,
        roleId: dto.roleId,
        estado: Estado.ACTIVO,
        user: { estado: Estado.ACTIVO },
        role: { estado: Estado.ACTIVO },
      },
      include: { role: true },
    });

    if (!assignment) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.role_select.denied',
          userId: payload.sub,
          roleId: dto.roleId,
        }),
      );
      throw new ForbiddenException('El rol no pertenece al usuario');
    }

    const session = await this.issueSessionTokens(
      payload.sub,
      assignment.role.id,
      assignment.role.name,
    );
    this.logger.log(
      JSON.stringify({
        event: 'auth.role_select.success',
        userId: payload.sub,
        roleId: assignment.role.id,
        roleName: assignment.role.name,
      }),
    );

    return session;
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
      include: { role: true },
    });

    if (!storedToken || storedToken.estado !== Estado.ACTIVO) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.denied',
          reason: 'not_found_or_inactive',
          userId: payload.sub,
          roleId: payload.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (storedToken.revokedAt || storedToken.replacedByJti) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: storedToken.userId,
          roleId: storedToken.roleId,
          estado: Estado.ACTIVO,
        },
        data: {
          revokedAt: new Date(),
          reuseDetected: true,
          estado: Estado.INACTIVO,
        },
      });
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.reuse_detected',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token reutilizado');
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date(), estado: Estado.INACTIVO },
      });
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.denied',
          reason: 'expired',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token expirado');
    }

    if (!(await argon2.verify(storedToken.tokenHash, refreshToken))) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.denied',
          reason: 'hash_mismatch',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token invalido');
    }

    const next = await this.issueSessionTokens(
      storedToken.userId,
      storedToken.roleId,
      storedToken.role.name,
    );

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByJti: next.refreshTokenJti,
        estado: Estado.INACTIVO,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'auth.refresh.success',
        userId: storedToken.userId,
        roleId: storedToken.roleId,
      }),
    );

    return next;
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, jti: payload.jti, estado: Estado.ACTIVO },
        data: { revokedAt: new Date(), estado: Estado.INACTIVO },
      });
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.logout.token_invalid',
          userId,
        }),
      );
      return { success: true };
    }

    this.logger.log(
      JSON.stringify({
        event: 'auth.logout.success',
        userId,
      }),
    );

    return { success: true };
  }

  async validateInternal(
    apiKey: string | undefined,
    token: string,
    serviceName: string | undefined,
  ) {
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');
    if (expectedKey && apiKey !== expectedKey) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.internal_validate.denied',
          reason: 'bad_api_key',
          serviceName,
        }),
      );
      throw new UnauthorizedException('API key interna invalida');
    }

    if (!this.isAllowedInternalService(serviceName)) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.internal_validate.denied',
          reason: 'service_not_allowed',
          serviceName,
        }),
      );
      throw new UnauthorizedException('Servicio interno no autorizado');
    }

    try {
      const payload = await this.jwtService.verifyAsync<GatewayTokenPayload>(
        token,
        {
          secret:
            this.configService.get<string>('JWT_SECRET') ??
            'change-me-access-secret',
          ...this.jwtVerifyClaims(),
        },
      );

      return {
        valid: true,
        userId: payload.sub,
        roleId: payload.roleId,
        roleName: payload.roleName,
      };
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.internal_validate.invalid_token',
          serviceName,
        }),
      );
      return { valid: false };
    }
  }

  private async verifyTempToken(tempToken: string) {
    try {
      return await this.jwtService.verifyAsync<TempTokenPayload>(tempToken, {
        secret:
          this.configService.get<string>('TEMP_JWT_SECRET') ??
          'change-me-temp-secret',
        ...this.jwtVerifyClaims(),
      });
    } catch {
      throw new UnauthorizedException('TempToken invalido o expirado');
    }
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<GatewayTokenPayload>(
        refreshToken,
        {
          secret:
            this.configService.get<string>('REFRESH_JWT_SECRET') ??
            'change-me-refresh-secret',
          ...this.jwtVerifyClaims(),
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }
  }

  private async issueSessionTokens(
    userId: string,
    roleId: string,
    roleName: string,
  ) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        roleId,
        roleName,
        jti: accessJti,
      } satisfies GatewayTokenPayload,
      {
        secret:
          this.configService.get<string>('JWT_SECRET') ??
          'change-me-access-secret',
        expiresIn: this.jwtExpiresIn('JWT_EXPIRES_IN', '15m'),
        ...this.jwtSignClaims(),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        roleId,
        roleName,
        jti: refreshJti,
      } satisfies GatewayTokenPayload,
      {
        secret:
          this.configService.get<string>('REFRESH_JWT_SECRET') ??
          'change-me-refresh-secret',
        expiresIn: this.jwtExpiresIn('REFRESH_JWT_EXPIRES_IN', '7d'),
        ...this.jwtSignClaims(),
      },
    );

    const decoded: unknown = this.jwtService.decode(refreshToken);
    const expiresAt =
      isDecodedJwt(decoded) && decoded.exp
        ? new Date(decoded.exp * 1000)
        : this.addDays(new Date(), 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        roleId,
        jti: refreshJti,
        tokenHash: await argon2.hash(refreshToken, { type: argon2.argon2id }),
        expiresAt,
        createdBy: userId,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenJti: refreshJti,
      tokenType: 'Bearer',
      expiresIn: this.jwtExpiresIn('JWT_EXPIRES_IN', '15m'),
      role: { id: roleId, name: roleName },
    };
  }

  private jwtExpiresIn(key: string, fallback: JwtExpiresIn) {
    return this.configService.get<JwtExpiresIn>(key) ?? fallback;
  }

  private jwtSignClaims(): JwtClaims {
    return {
      issuer: this.configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
      audience:
        this.configService.get<string>('JWT_AUDIENCE') ??
        'master-gateway-clients',
    };
  }

  private jwtVerifyClaims(): Pick<JwtVerifyOptions, 'audience' | 'issuer'> {
    return this.jwtSignClaims();
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private isAllowedInternalService(serviceName: string | undefined) {
    const allowedServices = (
      this.configService.get<string>('INTERNAL_ALLOWED_SERVICES') ?? ''
    )
      .split(',')
      .map((service) => service.trim())
      .filter(Boolean);

    return Boolean(serviceName && allowedServices.includes(serviceName));
  }

  private hashIdentifier(value: string) {
    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex')
      .slice(0, 16);
  }
}

function isDecodedJwt(value: unknown): value is DecodedJwt {
  if (!value || typeof value !== 'object' || !('exp' in value)) {
    return false;
  }

  const { exp } = value as { exp?: unknown };
  return typeof exp === 'number';
}
