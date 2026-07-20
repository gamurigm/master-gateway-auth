import { BadRequestException } from '@nestjs/common';
import { assertSafeProbeTarget } from './ssrf-guard';

describe('assertSafeProbeTarget', () => {
  const originalFlag = process.env['ALLOW_PRIVATE_PROBE_TARGETS'];

  beforeEach(() => {
    process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'false';
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env['ALLOW_PRIVATE_PROBE_TARGETS'];
    } else {
      process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = originalFlag;
    }
  });

  it('rechaza protocolos distintos de http y https', async () => {
    await expect(assertSafeProbeTarget('file:///etc/passwd')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(assertSafeProbeTarget('gopher://interno:70/')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza URLs con credenciales embebidas', async () => {
    await expect(
      assertSafeProbeTarget('http://usuario:clave@ejemplo.com/health'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza el endpoint de metadatos de la nube', async () => {
    // 169.254.169.254 expone credenciales de la instancia en AWS/GCP/Azure.
    await expect(
      assertSafeProbeTarget('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toThrow(/link-local|metadatos/i);
  });

  it('rechaza loopback y rangos privados', async () => {
    const blocked = [
      'http://127.0.0.1:3000/health',
      'http://10.1.2.3/health',
      'http://192.168.1.10/health',
      'http://172.16.0.5/health',
      'http://[::1]:3000/health',
    ];

    for (const target of blocked) {
      await expect(assertSafeProbeTarget(target)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rechaza IPv4 mapeada en IPv6 que apunta a loopback', async () => {
    // ::ffff:127.0.0.1 es una forma habitual de saltarse filtros que solo
    // comparan la cadena "127.0.0.1".
    await expect(assertSafeProbeTarget('http://[::ffff:127.0.0.1]/health')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza una URL mal formada', async () => {
    await expect(assertSafeProbeTarget('no-es-una-url')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('permite rangos privados cuando ALLOW_PRIVATE_PROBE_TARGETS esta activo', async () => {
    // Necesario en docker-compose y Kubernetes, donde los hijos viven en
    // direcciones privadas por definicion.
    process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'true';

    await expect(assertSafeProbeTarget('http://127.0.0.1:3006/health')).resolves.toMatchObject({
      address: '127.0.0.1',
    });
  });

  it('acepta una direccion publica', async () => {
    await expect(assertSafeProbeTarget('https://93.184.216.34/health')).resolves.toMatchObject({
      address: '93.184.216.34',
    });
  });
});
