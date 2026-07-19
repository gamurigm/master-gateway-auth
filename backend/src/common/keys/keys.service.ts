import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private privateKey = '';
  private publicKey = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.ensureKeysLoaded();
  }

  getPrivateKey(): string {
    this.ensureKeysLoaded();
    return this.privateKey;
  }

  getPublicKey(): string {
    this.ensureKeysLoaded();
    return this.publicKey;
  }

  private ensureKeysLoaded() {
    if (this.privateKey && this.publicKey) {
      return;
    }

    const privPath = resolve(
      this.configService.get<string>('JWT_PRIVATE_KEY_PATH') ??
        './keys/private.pem',
    );
    const pubPath = resolve(
      this.configService.get<string>('JWT_PUBLIC_KEY_PATH') ??
        './keys/public.pem',
    );

    if (!existsSync(privPath) || !existsSync(pubPath)) {
      this.logger.warn('No se encontraron llaves RSA. Generando nuevo par...');
      mkdirSync(resolve(privPath, '..'), { recursive: true });
      this.generateKeys(privPath, pubPath);
      return;
    }

    this.logger.log('Cargando llaves RSA existentes');
    this.privateKey = readFileSync(privPath, 'utf-8');
    this.publicKey = readFileSync(pubPath, 'utf-8');
  }

  private generateKeys(privPath: string, pubPath: string) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    writeFileSync(privPath, privateKey, { mode: 0o600 });
    writeFileSync(pubPath, publicKey, { mode: 0o644 });

    this.privateKey = privateKey;
    this.publicKey = publicKey;

    this.logger.log(`Llaves RSA generadas:
  Private: ${privPath}
  Public:  ${pubPath}`);
  }
}
