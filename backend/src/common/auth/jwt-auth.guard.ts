import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestWithUser } from './request-with-user';
import { AuthenticatedUser } from './authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice('Bearer '.length);

    try {
      request.user = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
      );
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
