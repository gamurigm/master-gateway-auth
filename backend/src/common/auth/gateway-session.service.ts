import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import type { JWTPayload } from 'jose';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from './authenticated-user';
import { decryptGatewayToken } from './jwe-token';

type AccessTokenPayload = JWTPayload & {
  sub?: string;
  jti?: string;
  sid?: string;
};

@Injectable()
export class GatewaySessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async resolveAccessToken(token: string): Promise<AuthenticatedUser> {
    const payload = await this.decryptAccessToken(token);
    const session = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.sid },
      include: { user: true, role: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.estado !== Estado.ACTIVO ||
      session.revokedAt ||
      session.replacedByJti ||
      session.expiresAt <= new Date() ||
      session.user.estado !== Estado.ACTIVO ||
      session.role.estado !== Estado.ACTIVO
    ) {
      throw new UnauthorizedException('Sesion invalida o revocada');
    }

    return {
      sub: payload.sub,
      jti: payload.jti,
      sid: payload.sid,
      roleId: session.roleId,
      roleName: session.role.name,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud: payload.aud,
    };
  }

  private async decryptAccessToken(token: string) {
    let payload: AccessTokenPayload;
    try {
      payload = (await decryptGatewayToken(
        token,
        this.configService,
      )) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }

    if (!payload.sub || !payload.jti || !payload.sid) {
      throw new UnauthorizedException('Token incompleto');
    }

    return {
      ...payload,
      sub: payload.sub,
      jti: payload.jti,
      sid: payload.sid,
    };
  }
}