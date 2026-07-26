import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createReportesServer,
  extractBearerToken,
  validateTokenWithMaster,
} from './server.js';

const baseConfig = {
  port: 0,
  masterValidateUrl: 'http://master.local/api/internals/validate-token',
  internalApiKey: 'test-key',
  internalServiceName: 'reportes',
  allowedRoles: ['SUPERADMIN', 'ADMIN', 'REPORTES'],
  frontendOrigin: 'http://localhost:4200',
  retryAttempts: 2,
  retryDelayMs: 0,
};

test('extractBearerToken returns the bearer token', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken(undefined), null);
});

test('validateTokenWithMaster posts the token to the Master Gateway', async () => {
  const originalFetch = globalThis.fetch;
  let sentHeaders: HeadersInit | undefined;
  globalThis.fetch = async (_url, init) => {
    sentHeaders = init?.headers;
    return response(200, {
      valid: true,
      userId: 'u1',
      roleId: 'r1',
      roleName: 'ADMIN',
    });
  };

  try {
    const result = await validateTokenWithMaster('token-value', baseConfig);
    assert.deepEqual(result, {
      valid: true,
      userId: 'u1',
      roleId: 'r1',
      roleName: 'ADMIN',
    });
    assert.deepEqual(sentHeaders, {
      'content-type': 'application/json',
      'x-internal-api-key': 'test-key',
      'x-internal-service': 'reportes',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('validateTokenWithMaster retries transient Master failures', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('temporary unavailable');
    }

    return response(200, { valid: true, roleName: 'ADMIN' });
  };

  try {
    const result = await validateTokenWithMaster('token-value', baseConfig);
    assert.equal(result.valid, true);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GET /health returns ok', async () => {
  const { url, close } = await listenTestServer();

  try {
    const result = await fetch(`${url}/health`);
    const body = (await result.json()) as { status: string; service: string };

    assert.equal(result.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'reportes');
  } finally {
    await close();
  }
});

test('GET /reportes/financieros returns 401 without bearer token', async () => {
  const { url, close } = await listenTestServer();

  try {
    const result = await fetch(`${url}/reportes/financieros`);
    assert.equal(result.status, 401);
  } finally {
    await close();
  }
});

test('GET /reportes/operaciones returns 401 without bearer token', async () => {
  const { url, close } = await listenTestServer();

  try {
    const result = await fetch(`${url}/reportes/operaciones`);
    assert.equal(result.status, 401);
  } finally {
    await close();
  }
});

test('GET /reportes/financieros returns 403 for roles outside reportes', async () => {
  const originalFetch = globalThis.fetch;
  const { url, close } = await listenTestServer();
  globalThis.fetch = mockFetch(200, {
    valid: true,
    userId: 'u1',
    roleId: 'r1',
    roleName: 'VENTAS',
  });

  try {
    const result = await originalFetch(`${url}/reportes/financieros`, {
      headers: { authorization: 'Bearer token-value' },
    });
    assert.equal(result.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    await close();
  }
});

test('GET /reportes/financieros returns report for ADMIN role', async () => {
  const originalFetch = globalThis.fetch;
  const { url, close } = await listenTestServer();
  globalThis.fetch = mockFetch(200, {
    valid: true,
    userId: 'u1',
    roleId: 'r1',
    roleName: 'ADMIN',
  });

  try {
    const result = await originalFetch(`${url}/reportes/financieros`, {
      headers: { authorization: 'Bearer token-value' },
    });
    const body = (await result.json()) as {
      context: { roleName: string };
      report: { period: string };
    };

    assert.equal(result.status, 200);
    assert.equal(body.context.roleName, 'ADMIN');
    assert.equal(body.report.period, '2026-07');
  } finally {
    globalThis.fetch = originalFetch;
    await close();
  }
});

test('GET /reportes/operaciones returns daily list for REPORTES role', async () => {
  const originalFetch = globalThis.fetch;
  const { url, close } = await listenTestServer();
  globalThis.fetch = mockFetch(200, {
    valid: true,
    userId: 'u1',
    roleId: 'r1',
    roleName: 'REPORTES',
  });

  try {
    const result = await originalFetch(`${url}/reportes/operaciones`, {
      headers: { authorization: 'Bearer token-value' },
    });
    const body = (await result.json()) as {
      context: { roleName: string };
      items: unknown[];
    };

    assert.equal(result.status, 200);
    assert.equal(body.context.roleName, 'REPORTES');
    assert.equal(body.items.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    await close();
  }
});

async function listenTestServer() {
  const server = createReportesServer(baseConfig);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert(address && typeof address === 'object');

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function mockFetch(status: number, body: unknown) {
  return async () => response(status, body);
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
