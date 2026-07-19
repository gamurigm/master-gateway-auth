import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInventarioServer,
  extractBearerToken,
  validateTokenWithMaster,
} from './server.js';

const baseConfig = {
  port: 0,
  masterValidateUrl: 'http://master.local/api/internals/validate-token',
  internalApiKey: 'test-key',
  internalServiceName: 'inventario',
  allowedRoles: ['SUPERADMIN', 'ADMIN', 'INVENTARIO'],
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
      'x-internal-service': 'inventario',
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

test('GET /inventario/productos returns 401 without bearer token', async () => {
  const { url, close } = await listenTestServer();

  try {
    const result = await fetch(`${url}/inventario/productos`);
    assert.equal(result.status, 401);
  } finally {
    await close();
  }
});

test('GET /inventario/productos returns 403 for roles outside inventory', async () => {
  const originalFetch = globalThis.fetch;
  const { url, close } = await listenTestServer();
  globalThis.fetch = mockFetch(200, {
    valid: true,
    userId: 'u1',
    roleId: 'r1',
    roleName: 'VENTAS',
  });

  try {
    const result = await originalFetch(`${url}/inventario/productos`, {
      headers: { authorization: 'Bearer token-value' },
    });
    assert.equal(result.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    await close();
  }
});

test('GET /inventario/productos returns products for an authorized role', async () => {
  const originalFetch = globalThis.fetch;
  const { url, close } = await listenTestServer();
  globalThis.fetch = mockFetch(200, {
    valid: true,
    userId: 'u1',
    roleId: 'r1',
    roleName: 'ADMIN',
  });

  try {
    const result = await originalFetch(`${url}/inventario/productos`, {
      headers: { authorization: 'Bearer token-value' },
    });
    const body = (await result.json()) as {
      items: unknown[];
      context: { roleName: string };
    };

    assert.equal(result.status, 200);
    assert.equal(body.context.roleName, 'ADMIN');
    assert.equal(body.items.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    await close();
  }
});

test('OPTIONS requests include CORS headers', async () => {
  const { url, close } = await listenTestServer();

  try {
    const result = await fetch(`${url}/inventario/productos`, {
      method: 'OPTIONS',
    });
    assert.equal(result.status, 204);
    assert.equal(
      result.headers.get('access-control-allow-origin'),
      'http://localhost:4200',
    );
  } finally {
    await close();
  }
});

async function listenTestServer() {
  const server = createInventarioServer(baseConfig);

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
