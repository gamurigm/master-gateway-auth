import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeysService } from '../keys/keys.service';
import { RequestWithUser } from './request-with-user';
import { AuthenticatedUser } from './authenticated-user';
import { verifyGatewayToken } from './gateway-token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly keysService: KeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice('Bearer '.length);

    try {
      // `'access'` es obligatorio: sin esta comprobacion el refresh token
      // (7 dias) servia tambien como access token (15 min).
      const claims = await verifyGatewayToken(
        token,
        this.configService,
        this.keysService,
        'access',
      );
      request.user = claims as unknown as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
