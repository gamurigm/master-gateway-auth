import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
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

@Injectable()
export class AuthService {
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
        secret: this.configService.get<string>('TEMP_JWT_SECRET') ?? 'change-me-temp-secret',
        expiresIn: this.configService.get<string>('TEMP_JWT_EXPIRES_IN') ?? '5m',
      },
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
      throw new ForbiddenException('El rol no pertenece al usuario');
    }

    return this.issueSessionTokens(payload.sub, assignment.role.id, assignment.role.name);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
      include: { role: true },
    });

    if (!storedToken || storedToken.estado !== Estado.ACTIVO) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (storedToken.revokedAt || storedToken.replacedByJti) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, roleId: storedToken.roleId, estado: Estado.ACTIVO },
        data: { revokedAt: new Date(), reuseDetected: true, estado: Estado.INACTIVO },
      });
      throw new UnauthorizedException('Refresh token reutilizado');
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date(), estado: Estado.INACTIVO },
      });
      throw new UnauthorizedException('Refresh token expirado');
    }

    if (!(await argon2.verify(storedToken.tokenHash, refreshToken))) {
      throw new UnauthorizedException('Refresh token invalido');
    }

    const next = await this.issueSessionTokens(storedToken.userId, storedToken.roleId, storedToken.role.name);

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByJti: next.refreshTokenJti,
        estado: Estado.INACTIVO,
      },
    });

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
      return { success: true };
    }

    return { success: true };
  }

  async validateInternal(apiKey: string | undefined, token: string) {
    const expectedKey = this.configService.get<string>('INTERNAL_API_KEY');
    if (expectedKey && apiKey !== expectedKey) {
      throw new UnauthorizedException('API key interna invalida');
    }

    try {
      const payload = await this.jwtService.verifyAsync<GatewayTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'change-me-access-secret',
      });

      return {
        valid: true,
        userId: payload.sub,
        roleId: payload.roleId,
        roleName: payload.roleName,
      };
    } catch {
      return { valid: false };
    }
  }

  private async verifyTempToken(tempToken: string) {
    try {
      return await this.jwtService.verifyAsync<TempTokenPayload>(tempToken, {
        secret: this.configService.get<string>('TEMP_JWT_SECRET') ?? 'change-me-temp-secret',
      });
    } catch {
      throw new UnauthorizedException('TempToken invalido o expirado');
    }
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<GatewayTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('REFRESH_JWT_SECRET') ?? 'change-me-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }
  }

  private async issueSessionTokens(userId: string, roleId: string, roleName: string) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, roleId, roleName, jti: accessJti } satisfies GatewayTokenPayload,
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'change-me-access-secret',
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, roleId, roleName, jti: refreshJti } satisfies GatewayTokenPayload,
      {
        secret: this.configService.get<string>('REFRESH_JWT_SECRET') ?? 'change-me-refresh-secret',
        expiresIn: this.configService.get<string>('REFRESH_JWT_EXPIRES_IN') ?? '7d',
      },
    );

    const decoded = this.jwtService.decode(refreshToken) as DecodedJwt | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : this.addDays(new Date(), 7);

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
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m',
      role: { id: roleId, name: roleName },
    };
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}
