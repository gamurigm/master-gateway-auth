import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtDecrypt } from 'jose';
import { RequestWithUser } from './request-with-user';
import { AuthenticatedUser } from './authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice('Bearer '.length);

    try {
      const jweSecret = this.configService.get<string>('JWE_SECRET');
      if (!jweSecret) {
        throw new Error('JWE_SECRET no configurado');
      }

      const secret = new TextEncoder().encode(jweSecret);
      const { payload } = await jwtDecrypt(token, secret);

      request.user = payload as unknown as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
