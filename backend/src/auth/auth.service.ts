import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { EncryptJWT, importSPKI } from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { decryptGatewayToken } from '../common/auth/jwe-token';
import { omitPassword } from '../common/utils/omit-password';
import { KeysService } from '../common/keys/keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SelectRoleDto } from './dto/select-role.dto';

type TempTokenPayload = {
  sub: string;
  jti: string;
  email: string;
};

type GatewayTokenPayload = {
  sub: string;
  jti: string;
  roleId: string;
  roleName?: string;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenJti: string;
  tokenType: string;
  expiresIn: string;
  role: { id: string; name: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly keysService: KeysService,
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
      {
        sub: user.id,
        jti: randomUUID(),
        email: user.email,
      } satisfies TempTokenPayload,
      { expiresIn: '5m' },
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

  async selectRole(dto: SelectRoleDto): Promise<SessionTokens> {
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
    // La comprobacion es incondicional: si INTERNAL_API_KEY faltara, el guard
    // anterior (`expectedKey && ...`) dejaba pasar cualquier peticion interna.
    // env.validation ya exige la variable, pero esto es defensa en profundidad.
    const expectedKey = process.env['INTERNAL_API_KEY'];
    if (!expectedKey || apiKey !== expectedKey) {
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
      const payload = (await decryptGatewayToken(
        token,
        this.configService,
        this.keysService,
      )) as GatewayTokenPayload;

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
      return await this.jwtService.verifyAsync<TempTokenPayload>(tempToken);
    } catch {
      throw new UnauthorizedException('TempToken invalido o expirado');
    }
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      const payload = (await decryptGatewayToken(
        refreshToken,
        this.configService,
        this.keysService,
      )) as GatewayTokenPayload;
      if (!payload.sub || !payload.jti) {
        throw new Error('Refresh token incompleto');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }
  }

  private async issueSessionTokens(
    userId: string,
    roleId: string,
    roleName: string,
  ): Promise<SessionTokens> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const publicKey = await importSPKI(
      this.keysService.getPublicKey(),
      'RSA-OAEP-256',
    );


    const accessToken = await new EncryptJWT({
      sub: userId,
      jti: accessJti,
      roleId,
      roleName,
    })
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .setIssuer(
        this.configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
      )
      .setAudience(
        this.configService.get<string>('JWT_AUDIENCE') ??
          'master-gateway-clients',
      )
      .encrypt(publicKey);

    const refreshToken = await new EncryptJWT({
      sub: userId,
      jti: refreshJti,
      roleId,
      roleName,
    } satisfies GatewayTokenPayload)
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .setIssuer(
        this.configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
      )
      .setAudience(
        this.configService.get<string>('JWT_AUDIENCE') ??
          'master-gateway-clients',
      )
      .encrypt(publicKey);

    const expiresAt = this.addDays(new Date(), 7);

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
      expiresIn: '15m',
      role: { id: roleId, name: roleName },
    };
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private isAllowedInternalService(serviceName: string | undefined) {
    const allowedServices = (process.env['INTERNAL_ALLOWED_SERVICES'] ?? '')
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
