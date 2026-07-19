import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

type TokenValidation = {
  valid: boolean;
  userId?: string;
  roleId?: string;
  roleName?: string;
};

type InventarioConfig = {
  port: number;
  masterValidateUrl: string;
  internalApiKey: string;
  internalServiceName: string;
  allowedRoles: string[];
  frontendOrigin: string;
  retryAttempts: number;
  retryDelayMs: number;
};

const products = [
  { sku: 'INV-001', name: 'Laptop segura', stock: 18, status: 'DISPONIBLE' },
  { sku: 'INV-002', name: 'Token USB FIDO2', stock: 42, status: 'DISPONIBLE' },
  { sku: 'INV-003', name: 'Servidor laboratorio', stock: 3, status: 'RESERVADO' },
];

export function loadConfig(env = process.env): InventarioConfig {
  return {
    port: Number(env['INVENTARIO_PORT'] ?? 3007),
    masterValidateUrl:
      env['MASTER_VALIDATE_URL'] ??
      'http://localhost:3000/api/internals/validate-token',
    internalApiKey:
      env['MASTER_INTERNAL_API_KEY'] ??
      env['INTERNAL_API_KEY'] ??
      'change-me-internal-key',
    internalServiceName: env['MASTER_INTERNAL_SERVICE_NAME'] ?? 'inventario',
    allowedRoles: (env['INVENTARIO_ALLOWED_ROLES'] ?? 'SUPERADMIN,ADMIN,INVENTARIO')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
    frontendOrigin: env['FRONTEND_ORIGIN'] ?? 'http://localhost:4200',
    retryAttempts: Number(env['MASTER_VALIDATE_RETRY_ATTEMPTS'] ?? 3),
    retryDelayMs: Number(env['MASTER_VALIDATE_RETRY_DELAY_MS'] ?? 500),
  };
}

export function createInventarioServer(config = loadConfig()) {
  return createHttpServer(async (request, response) => {
    applyCors(response, config);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { status: 'ok', service: 'inventario' });
    }

    if (request.method === 'GET' && url.pathname === '/inventario/productos') {
      return handleProducts(request, response, config);
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

export async function validateTokenWithMaster(
  token: string,
  config: InventarioConfig,
): Promise<TokenValidation> {
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

  throw lastError instanceof Error
    ? lastError
    : new Error('Master validation unavailable');
}

async function handleProducts(
  request: IncomingMessage,
  response: ServerResponse,
  config: InventarioConfig,
) {
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
    return sendJson(response, 403, {
      message: 'Rol no autorizado para inventario',
    });
  }

  return sendJson(response, 200, {
    context: {
      userId: validation.userId,
      roleId: validation.roleId,
      roleName: validation.roleName,
    },
    items: products,
  });
}

function applyCors(response: ServerResponse, config: InventarioConfig) {
  response.setHeader('access-control-allow-origin', config.frontendOrigin);
  response.setHeader('access-control-allow-methods', 'GET,OPTIONS');
  response.setHeader(
    'access-control-allow-headers',
    'authorization,content-type',
  );
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const config = loadConfig();
  createInventarioServer(config).listen(config.port, () => {
    console.log(
      `Inventario service listening on http://localhost:${config.port}`,
    );
  });
}
