import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RequestWithUser } from './request-with-user';
import { AuthenticatedUser } from './authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice('Bearer '.length);
    const secret =
      this.configService.get<string>('JWT_SECRET') ?? 'change-me-access-secret';

    try {
      request.user = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        {
          secret,
          issuer:
            this.configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
          audience:
            this.configService.get<string>('JWT_AUDIENCE') ??
            'master-gateway-clients',
        },
      );
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
