import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { exportJWK } from 'jose';
import type { JWK } from 'jose';
import { GATEWAY_TOKEN_ALGORITHM } from '../auth/gateway-token';

@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private privateKey = '';
  private publicKey = '';
  private jwksCache: { keys: JWK[] } | null = null;

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

  async getJwks(): Promise<{ keys: JWK[] }> {
    this.ensureKeysLoaded();
    if (this.jwksCache) return this.jwksCache;

    const publicKeyObject = createPublicKey(this.publicKey);
    const jwk = await exportJWK(publicKeyObject);
    // La clave se publica para VERIFICAR FIRMAS (`use: 'sig'`), no para cifrar.
    // Publicarla como `use: 'enc'` era parte del fallo critico: anunciaba a
    // quien quisiera la clave con la que se fabricaban tokens validos.
    jwk.alg = GATEWAY_TOKEN_ALGORITHM;
    jwk.kid = 'master-gateway-v1';
    jwk.use = 'sig';

    this.jwksCache = { keys: [jwk] };
    return this.jwksCache;
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
    this.jwksCache = null;
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
    this.jwksCache = null;

    this.logger.log(`Llaves RSA generadas:
  Private: ${privPath}
  Public:  ${pubPath}`);
  }
}
