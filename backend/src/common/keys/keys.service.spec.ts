import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { KeysService } from './keys.service';

describe('KeysService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'keys-service-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads keys when requested before module initialization', () => {
    const privateKeyPath = join(tempDir, 'private.pem');
    const publicKeyPath = join(tempDir, 'public.pem');
    writeFileSync(privateKeyPath, 'private-key');
    writeFileSync(publicKeyPath, 'public-key');

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_PRIVATE_KEY_PATH') return privateKeyPath;
        if (key === 'JWT_PUBLIC_KEY_PATH') return publicKeyPath;
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new KeysService(configService);

    expect(service.getPrivateKey()).toBe('private-key');
    expect(service.getPublicKey()).toBe('public-key');
  });
});
