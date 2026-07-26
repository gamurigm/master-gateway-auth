import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import * as dns from 'node:dns';
import * as net from 'node:net';
import { promisify } from 'node:util';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

const lookupAsync = promisify(dns.lookup);

const FORBIDDEN_NETWORKS: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['::ffff:127.0.0.0', 104],
];

@Injectable()
export class InternalProxyService {
  private readonly logger = new Logger(InternalProxyService.name);
  private readonly lookupCache = new Map<
    string,
    { address: string; expires: number }
  >();
  private readonly cacheTtlMs = 60_000;
  private readonly internalApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.internalApiKey =
      this.configService.get<string>('INTERNAL_API_KEY') ?? '';
  }

  async proxyRequest(
    moduleCode: string,
    path: string,
    method: string,
    query: Record<string, unknown>,
    headers: Record<string, string>,
    body: unknown,
    user: AuthenticatedUser,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: unknown;
  }> {
    const module = await this.prisma.systemModule.findFirst({
      where: { code: moduleCode, estado: Estado.ACTIVO },
    });

    if (!module) {
      throw new NotFoundException('Modulo no encontrado');
    }

    if (!module.baseUrl || !module.serviceName) {
      throw new BadGatewayException('Modulo no configurado para proxy interno');
    }

    const hasAccess = await this.prisma.roleModule.findFirst({
      where: {
        roleId: user.roleId,
        moduleId: module.id,
        estado: Estado.ACTIVO,
        role: { estado: Estado.ACTIVO },
      },
    });

    if (!hasAccess) {
      this.logger.warn(
        JSON.stringify({
          event: 'internal_proxy.access_denied',
          moduleCode,
          userId: user.sub,
          roleId: user.roleId,
        }),
      );
      throw new ForbiddenException('No tiene acceso a este modulo');
    }

    const targetUrl = this.buildTargetUrl(module.baseUrl, path, query);
    await this.assertUrlSafe(targetUrl);

    const safeHeaders = this.buildForwardHeaders(
      headers,
      user,
      module.serviceName,
    );

    this.logger.log(
      JSON.stringify({
        event: 'internal_proxy.forward',
        moduleCode,
        serviceName: module.serviceName,
        method,
        path,
        userId: user.sub,
        roleId: user.roleId,
      }),
    );

    return this.forwardRequest(targetUrl, method, safeHeaders, body);
  }

  private buildTargetUrl(
    baseUrl: string,
    path: string,
    query: Record<string, unknown>,
  ): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${cleanBase}${cleanPath}`;

    const queryEntries = Object.entries(query);
    if (queryEntries.length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of queryEntries) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'string') searchParams.append(key, v);
            else if (typeof v === 'number' || typeof v === 'boolean')
              searchParams.append(key, v.toString());
          }
        } else if (typeof value === 'string') {
          searchParams.set(key, value);
        } else if (
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          typeof value === 'bigint'
        ) {
          searchParams.set(key, value.toString());
        } else if (typeof value === 'object') {
          searchParams.set(key, JSON.stringify(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  private buildForwardHeaders(
    incoming: Record<string, string>,
    user: AuthenticatedUser,
    serviceName: string,
  ): Record<string, string> {
    const skip = new Set([
      'host',
      'connection',
      'content-length',
      'accept-encoding',
      'authorization',
      'cookie',
      'x-internal-api-key',
      'x-internal-service',
    ]);

    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!skip.has(key.toLowerCase()) && value !== undefined) {
        out[key] = String(value);
      }
    }

    out['x-user-id'] = user.sub;
    out['x-role-id'] = user.roleId;
    out['x-role-name'] = user.roleName;
    out['x-session-id'] = user.sid;

    if (this.internalApiKey) {
      out['x-internal-api-key'] = this.internalApiKey;
    }
    out['x-internal-service'] = serviceName;

    if (!out['content-type']) {
      out['content-type'] = 'application/json';
    }
    out['accept'] = incoming['accept'] ?? 'application/json, text/plain, */*';

    return out;
  }

  private async forwardRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: unknown;
  }> {
    const controller = new AbortController();
    const timeoutMs = 30_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      const requestInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
        redirect: 'error',
      };

      if (
        method !== 'GET' &&
        method !== 'HEAD' &&
        body !== undefined &&
        body !== null &&
        !(body instanceof Uint8Array && body.length === 0)
      ) {
        if (typeof body === 'string' || body instanceof Uint8Array) {
          requestInit.body = body as BodyInit;
        } else {
          requestInit.body = JSON.stringify(body);
        }
      }

      response = await fetch(url, requestInit);
    } catch (error) {
      clearTimeout(timer);
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.error(
        JSON.stringify({
          event: 'internal_proxy.forward_error',
          url,
          method,
          reason,
        }),
      );
      if ((error as Error).name === 'AbortError') {
        throw new ServiceUnavailableException(
          'Tiempo de espera agotado en servicio interno',
        );
      }
      throw new BadGatewayException(
        'No se pudo conectar con el servicio interno',
      );
    }
    clearTimeout(timer);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      if (
        lk !== 'transfer-encoding' &&
        lk !== 'connection' &&
        lk !== 'keep-alive' &&
        lk !== 'content-encoding'
      ) {
        responseHeaders[key] = value;
      }
    });

    const contentType = response.headers.get('content-type') ?? '';
    let responseBody: unknown;
    if (/application\/json/i.test(contentType)) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }
    } else {
      responseBody = await response.text();
    }

    return {
      status: response.status,
      headers: responseHeaders,
      body: responseBody,
    };
  }

  private async assertUrlSafe(urlString: string) {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      throw new BadGatewayException('URL destino invalida');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadGatewayException('Protocolo no permitido');
    }

    const hostname = url.hostname;
    if (!hostname) {
      throw new BadGatewayException('Host vacio');
    }

    if (net.isIP(hostname)) {
      this.assertIpNotPrivate(hostname, urlString);
      return;
    }

    const now = Date.now();
    const cached = this.lookupCache.get(hostname);
    let address: string;
    if (cached && cached.expires > now) {
      address = cached.address;
    } else {
      try {
        const result = await lookupAsync(hostname, { family: 4 });
        address = result.address;
        this.lookupCache.set(hostname, {
          address,
          expires: now + this.cacheTtlMs,
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'internal_proxy.ssrf.dns_failed',
            hostname,
            reason: error instanceof Error ? error.message : 'unknown',
          }),
        );
        throw new BadGatewayException('No se pudo resolver el host destino');
      }
    }

    this.assertIpNotPrivate(address, urlString);
  }

  private assertIpNotPrivate(ip: string, context: string) {
    for (const [network, prefix] of FORBIDDEN_NETWORKS) {
      if (this.isIpInNetwork(ip, network, prefix)) {
        this.logger.warn(
          JSON.stringify({
            event: 'internal_proxy.ssrf.blocked',
            ip,
            network,
            prefix,
            context,
          }),
        );
        throw new BadGatewayException('Destino no permitido por politica SSRF');
      }
    }
  }

  private isIpInNetwork(ip: string, network: string, prefix: number): boolean {
    const ipNum = this.ipToNumber(ip);
    if (ipNum === null) return false;

    const netNum = this.ipToNumber(network);
    if (netNum === null) return false;

    const mask = prefix === 0 ? 0 : 0xffffffff << (32 - prefix);
    return ((ipNum >>> 0) & (mask >>> 0)) === ((netNum >>> 0) & (mask >>> 0));
  }

  private ipToNumber(ip: string): number | null {
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map((p) => parseInt(p, 10));
      if (parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    }
    if (ip === '::1') {
      return this.ipToNumber('127.0.0.1');
    }
    if (ip.startsWith('::ffff:')) {
      const v4part = ip.slice('::ffff:'.length);
      return this.ipToNumber(v4part);
    }
    return 0;
  }
}
