import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { RequestWithUser } from '../common/auth/request-with-user';
import { assertSafeProbeTarget } from '../external-services/ssrf-guard';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PROXY_TIMEOUT_MS = 10_000;
const FULL_ACCESS_ROLE_NAMES = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN'];
const BLOCKED_REQUEST_HEADERS = new Set([
  'authorization',
  'connection',
  'content-length',
  'cookie',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const BLOCKED_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

interface ProxyResult {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
}

@Injectable()
export class ServiceProxyService {
  private readonly logger = new Logger(ServiceProxyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async forward(request: RequestWithUser): Promise<ProxyResult> {
    const user = this.requireUser(request.user);
    const method = request.method.toUpperCase();
    const publicPath = this.extractPublicPath(
      request.originalUrl ?? request.url,
    );
    const resolved = await this.resolveRoute(publicPath);

    if (!resolved) {
      throw new NotFoundException('Endpoint de microservicio no registrado');
    }

    const { route, params } = resolved;
    if (!route.methods.includes(method)) {
      throw new MethodNotAllowedException(
        `Metodo ${method} no permitido para este endpoint`,
      );
    }

    await this.ensureAuthorized(user, route.menuId);

    const target = this.buildTargetUrl(
      route.service.baseUrl,
      route.targetPath,
      request.originalUrl ?? request.url,
      params,
    );
    await assertSafeProbeTarget(target.toString());

    try {
      const upstream = await fetch(target, {
        method,
        headers: this.buildHeaders(request, user),
        body: this.buildBody(request, method),
        redirect: 'manual',
        signal: AbortSignal.timeout(this.proxyTimeoutMs()),
      });

      return {
        statusCode: upstream.status,
        headers: this.copyResponseHeaders(upstream.headers),
        body: Buffer.from(await upstream.arrayBuffer()),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'Microservicio no respondio a tiempo',
        );
      }

      this.logger.warn(
        JSON.stringify({
          event: 'service_proxy.upstream_failed',
          publicPath,
          method,
          target: this.redactTarget(target),
          reason: error instanceof Error ? error.message : 'unknown',
        }),
      );
      throw new BadGatewayException('No se pudo contactar el microservicio');
    }
  }

  private requireUser(user: AuthenticatedUser | undefined) {
    if (!user) {
      throw new ForbiddenException('Usuario autenticado requerido');
    }
    return user;
  }

  private extractPublicPath(originalUrl: string) {
    const withoutQuery = originalUrl.split('?')[0] ?? '';
    const path = withoutQuery.replace(/^\/api\/proxy/, '') || '/';
    return `/${path.replace(/^\/+/, '')}`;
  }

  private async resolveRoute(publicPath: string) {
    const routes = await this.prisma.externalServiceRoute.findMany({
      where: {
        estado: Estado.ACTIVO,
        service: { estado: Estado.ACTIVO },
        menu: { estado: Estado.ACTIVO, module: { estado: Estado.ACTIVO } },
      },
      include: {
        service: true,
        menu: { include: { module: true } },
      },
    });

    for (const route of routes) {
      const params = this.matchPath(route.publicPath, publicPath);
      if (params) {
        return { route, params };
      }
    }

    return null;
  }

  private matchPath(pattern: string, actual: string) {
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);
    if (patternParts.length !== actualParts.length) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let index = 0; index < patternParts.length; index += 1) {
      const patternPart = patternParts[index];
      const actualPart = actualParts[index];
      if (!patternPart || !actualPart) {
        return null;
      }
      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = decodeURIComponent(actualPart);
        continue;
      }
      if (patternPart !== actualPart) {
        return null;
      }
    }

    return params;
  }

  private async ensureAuthorized(user: AuthenticatedUser, menuId: string) {
    if (this.hasFullAccess(user.roleName)) {
      return;
    }

    const assignment = await this.prisma.roleMenu.count({
      where: {
        roleId: user.roleId,
        menuId,
        estado: Estado.ACTIVO,
        role: { estado: Estado.ACTIVO },
        menu: { estado: Estado.ACTIVO, module: { estado: Estado.ACTIVO } },
      },
    });

    if (assignment === 0) {
      throw new ForbiddenException('El rol no tiene acceso a este item');
    }
  }

  private hasFullAccess(roleName: string) {
    const configured = this.configService.get<string>('FULL_ACCESS_ROLE_NAMES');
    const roles = configured
      ? configured
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean)
      : FULL_ACCESS_ROLE_NAMES;
    return roles.includes(roleName);
  }

  private buildTargetUrl(
    baseUrl: string,
    targetPath: string,
    originalUrl: string,
    params: Record<string, string>,
  ) {
    const query = originalUrl.includes('?')
      ? `?${originalUrl.split('?').slice(1).join('?')}`
      : '';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const replacedPath = targetPath.replace(
      /:([A-Za-z0-9_]+)/g,
      (_, key: string) => encodeURIComponent(params[key] ?? ''),
    );
    const path = replacedPath.replace(/^\/+/, '');
    return new URL(`${path}${query}`, normalizedBase);
  }

  private buildHeaders(request: RequestWithUser, user: AuthenticatedUser) {
    const headers = new Headers();

    for (const [name, rawValue] of Object.entries(request.headers)) {
      const lower = name.toLowerCase();
      if (BLOCKED_REQUEST_HEADERS.has(lower)) {
        continue;
      }

      const value = Array.isArray(rawValue) ? rawValue.join(',') : rawValue;
      if (typeof value === 'string') {
        headers.set(name, value);
      }
    }

    headers.set('x-request-id', request.requestId ?? 'unknown');
    headers.set('x-gateway-user-id', user.sub);
    headers.set('x-gateway-role-id', user.roleId);
    headers.set('x-gateway-role-name', user.roleName);

    return headers;
  }

  private buildBody(
    request: RequestWithUser,
    method: string,
  ): BodyInit | undefined {
    if (method === 'GET' || method === 'HEAD') {
      return undefined;
    }

    const body = request.body as unknown;
    if (body === undefined || body === null) {
      return undefined;
    }

    if (typeof body === 'string') {
      return body;
    }

    if (Buffer.isBuffer(body)) {
      return body.toString();
    }

    return JSON.stringify(body);
  }
  private copyResponseHeaders(headers: Headers) {
    const copied: Record<string, string> = {};
    headers.forEach((value, name) => {
      if (!BLOCKED_RESPONSE_HEADERS.has(name.toLowerCase())) {
        copied[name] = value;
      }
    });
    return copied;
  }

  private proxyTimeoutMs() {
    return Number(
      this.configService.get<string>('SERVICE_PROXY_TIMEOUT_MS') ??
        DEFAULT_PROXY_TIMEOUT_MS,
    );
  }

  private redactTarget(target: URL) {
    return `${target.protocol}//${target.host}${target.pathname}`;
  }
}
