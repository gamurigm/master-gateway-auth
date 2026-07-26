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

type ReportesConfig = {
  port: number;
  masterValidateUrl: string;
  internalApiKey: string;
  internalServiceName: string;
  allowedRoles: string[];
  frontendOrigin: string;
  retryAttempts: number;
  retryDelayMs: number;
};

const financialSummary = {
  period: '2026-07',
  currency: 'USD',
  totalVentas: 128450.75,
  totalInventario: 95320.25,
  margenBruto: 33130.5,
  ordenesProcesadas: 1247,
  rotacionInventario: 4.8,
  topCategorias: [
    { name: 'Electronica', value: 62100.5 },
    { name: 'Seguridad', value: 38520.0 },
    { name: 'Servicios', value: 27830.25 },
  ],
};

const dailyOperations = [
  {
    date: '2026-07-24',
    ordenes: 86,
    monto: 14820.5,
    unidadesVendidas: 192,
    devoluciones: 2,
  },
  {
    date: '2026-07-23',
    ordenes: 72,
    monto: 12350.25,
    unidadesVendidas: 168,
    devoluciones: 0,
  },
  {
    date: '2026-07-22',
    ordenes: 93,
    monto: 17420.75,
    unidadesVendidas: 215,
    devoluciones: 3,
  },
];

export function loadConfig(env = process.env): ReportesConfig {
  return {
    port: Number(env['REPORTES_PORT'] ?? 3038),
    masterValidateUrl:
      env['MASTER_VALIDATE_URL'] ??
      'http://localhost:3000/api/internals/validate-token',
    internalApiKey:
      env['MASTER_INTERNAL_API_KEY'] ??
      env['INTERNAL_API_KEY'] ??
      'change-me-internal-key',
    internalServiceName: env['MASTER_INTERNAL_SERVICE_NAME'] ?? 'reportes',
    allowedRoles: (env['REPORTES_ALLOWED_ROLES'] ?? 'SUPERADMIN,ADMIN,REPORTES')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
    frontendOrigin: env['FRONTEND_ORIGIN'] ?? 'http://localhost:4200',
    retryAttempts: Number(env['MASTER_VALIDATE_RETRY_ATTEMPTS'] ?? 3),
    retryDelayMs: Number(env['MASTER_VALIDATE_RETRY_DELAY_MS'] ?? 500),
  };
}

export function createReportesServer(config = loadConfig()) {
  return createHttpServer(async (request, response) => {
    applyCors(response, config);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { status: 'ok', service: 'reportes' });
    }

    if (request.method === 'GET' && url.pathname === '/reportes/financieros') {
      return handleFinancialReport(request, response, config);
    }

    if (request.method === 'GET' && url.pathname === '/reportes/operaciones') {
      return handleOperationsReport(request, response, config);
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
  config: ReportesConfig,
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

async function handleFinancialReport(
  request: IncomingMessage,
  response: ServerResponse,
  config: ReportesConfig,
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
      message: 'Rol no autorizado para reportes financieros',
    });
  }

  return sendJson(response, 200, {
    context: {
      userId: validation.userId,
      roleId: validation.roleId,
      roleName: validation.roleName,
    },
    report: financialSummary,
  });
}

async function handleOperationsReport(
  request: IncomingMessage,
  response: ServerResponse,
  config: ReportesConfig,
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
      message: 'Rol no autorizado para reportes operacionales',
    });
  }

  return sendJson(response, 200, {
    context: {
      userId: validation.userId,
      roleId: validation.roleId,
      roleName: validation.roleName,
    },
    items: dailyOperations,
  });
}

function applyCors(response: ServerResponse, config: ReportesConfig) {
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
  createReportesServer(config).listen(config.port, () => {
    console.log(
      `Reportes service listening on http://localhost:${config.port}`,
    );
  });
}
