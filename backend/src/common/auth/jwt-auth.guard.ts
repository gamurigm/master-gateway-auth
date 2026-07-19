import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestWithUser } from './request-with-user';
import { GatewaySessionService } from './gateway-session.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly gatewaySessionService: GatewaySessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice('Bearer '.length);

    try {
      request.user = await this.gatewaySessionService.resolveAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}