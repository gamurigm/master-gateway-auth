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
import { createHash, randomUUID } from 'node:crypto';
import {
  signGatewayToken,
  verifyGatewayToken,
} from '../common/auth/gateway-token';
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

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenJti: string;
  tokenType: string;
  expiresIn: string;
  role: { id: string; name: string };
  permissions: string[];
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
      await this.revokeTokenFamily(storedToken.userId, storedToken.roleId);
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

    // Consumo ATOMICO del refresh token. Las comprobaciones anteriores son de
    // solo lectura, asi que dos peticiones concurrentes con el mismo token las
    // superaban ambas (veian `revokedAt: null`) y se emitian DOS familias
    // validas sin disparar la deteccion de reuso. El `updateMany` condicional
    // es el punto de serializacion: la base de datos garantiza que solo una de
    // las peticiones concurrentes obtiene `count === 1`.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        estado: Estado.ACTIVO,
        revokedAt: null,
        replacedByJti: null,
      },
      data: { revokedAt: new Date(), estado: Estado.INACTIVO },
    });

    if (claimed.count !== 1) {
      await this.revokeTokenFamily(storedToken.userId, storedToken.roleId);
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.reuse_detected',
          reason: 'concurrent_use',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token reutilizado');
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
      const claims = await verifyGatewayToken(
        token,
        this.configService,
        this.keysService,
        'access',
      );

      // El PDF (Figura 3) especifica que la respuesta a los hijos incluya los
      // permisos, para que puedan autorizar sin consultar la base del Master.
      return {
        valid: true,
        userId: claims.sub,
        roleId: claims.roleId,
        roleName: claims.roleName,
        permissions: claims.permissions ?? [],
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
      // `'refresh'` impide presentar un access token aqui y viceversa.
      return await verifyGatewayToken(
        refreshToken,
        this.configService,
        this.keysService,
        'refresh',
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }
  }

  /**
   * Permisos ACTIVOS del rol elegido.
   *
   * Menor privilegio (§6.2): el token lleva solo los permisos de ESE rol, no
   * los globales del usuario ni los de otros roles que tenga asignados.
   */
  private async permissionsForRole(roleId: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        estado: Estado.ACTIVO,
        permission: { estado: Estado.ACTIVO },
      },
      include: { permission: { select: { code: true } } },
    });

    return rolePermissions.map((entry) => entry.permission.code).sort();
  }

  private async issueSessionTokens(
    userId: string,
    roleId: string,
    roleName: string,
  ): Promise<SessionTokens> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const permissions = await this.permissionsForRole(roleId);

    const accessToken = await signGatewayToken(
      {
        sub: userId,
        jti: accessJti,
        roleId,
        roleName,
        tokenUse: 'access',
        permissions,
        expiresIn: '15m',
      },
      this.configService,
      this.keysService,
    );

    const refreshToken = await signGatewayToken(
      {
        sub: userId,
        jti: refreshJti,
        roleId,
        roleName,
        tokenUse: 'refresh',
        expiresIn: '7d',
      },
      this.configService,
      this.keysService,
    );

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
      permissions,
    };
  }

  /** Revoca TODA la familia de refresh tokens del par usuario/rol (OWASP). */
  private async revokeTokenFamily(userId: string, roleId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, roleId, estado: Estado.ACTIVO },
      data: {
        revokedAt: new Date(),
        reuseDetected: true,
        estado: Estado.INACTIVO,
      },
    });
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
