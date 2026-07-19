import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

type TokenValidation = {
  valid: boolean;
  userId?: string;
  roleId?: string;
  roleName?: string;
};

type VentasConfig = {
  port: number;
  masterValidateUrl: string;
  internalApiKey: string;
  internalServiceName: string;
  allowedRoles: string[];
  retryAttempts: number;
  retryDelayMs: number;
};

const orders = [
  { id: 'ORD-001', customer: 'Demo Retail', total: 125.75, status: 'CREADA' },
  { id: 'ORD-002', customer: 'ESPE Lab', total: 89.5, status: 'APROBADA' },
];

export function loadConfig(env = process.env): VentasConfig {
  return {
    port: Number(env['VENTAS_PORT'] ?? 3006),
    masterValidateUrl: env['MASTER_VALIDATE_URL'] ?? 'http://localhost:3000/api/internals/validate-token',
    internalApiKey: env['MASTER_INTERNAL_API_KEY'] ?? env['INTERNAL_API_KEY'] ?? 'change-me-internal-key',
    internalServiceName: env['MASTER_INTERNAL_SERVICE_NAME'] ?? 'ventas',
    allowedRoles: (env['VENTAS_ALLOWED_ROLES'] ?? 'SUPERADMIN,ADMIN,VENTAS')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
    retryAttempts: Number(env['MASTER_VALIDATE_RETRY_ATTEMPTS'] ?? 3),
    retryDelayMs: Number(env['MASTER_VALIDATE_RETRY_DELAY_MS'] ?? 500),
  };
}

export function createVentasServer(config = loadConfig()) {
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { status: 'ok', service: 'ventas' });
    }

    if (request.method === 'GET' && url.pathname === '/ventas/ordenes') {
      return handleOrders(request, response, config);
    }

    return sendJson(response, 404, { message: 'Ruta no encontrada' });
  });
}

export function extractBearerToken(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}

export async function validateTokenWithMaster(token: string, config: VentasConfig): Promise<TokenValidation> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.retryAttempts; attempt += 1) {
    try {
      const response = await fetch(config.masterValidateUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': config.internalApiKey,
          'x-internal-service': config.internalServiceName,
        },
        body: JSON.stringify({ token }),
      });

      if (response.status === 401 || response.status === 403) {
        return { valid: false };
      }

      if (!response.ok) {
        throw new Error(`Master validation failed with ${response.status}`);
      }

      return (await response.json()) as TokenValidation;
    } catch (error) {
      lastError = error;
      if (attempt < config.retryAttempts) {
        await delay(config.retryDelayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Master validation unavailable');
}

async function handleOrders(request: IncomingMessage, response: ServerResponse, config: VentasConfig) {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    return sendJson(response, 401, { message: 'Token requerido' });
  }

  let validation: TokenValidation;
  try {
    validation = await validateTokenWithMaster(token, config);
  } catch {
    return sendJson(response, 503, { message: 'Master Gateway no disponible' });
  }

  if (!validation.valid) {
    return sendJson(response, 401, { message: 'Token invalido o expirado' });
  }

  if (!validation.roleName || !config.allowedRoles.includes(validation.roleName)) {
    return sendJson(response, 403, { message: 'Rol no autorizado para ventas' });
  }

  return sendJson(response, 200, {
    context: {
      userId: validation.userId,
      roleId: validation.roleId,
      roleName: validation.roleName,
    },
    items: orders,
  });
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const config = loadConfig();
  createVentasServer(config).listen(config.port, () => {
    console.log(`Ventas service listening on http://localhost:${config.port}`);
  });
}
