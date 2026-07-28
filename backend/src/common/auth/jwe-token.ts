import { ConfigService } from '@nestjs/config';
import { importPKCS8, jwtDecrypt, JWTPayload } from 'jose';
import { KeysService } from '../keys/keys.service';

export async function decryptGatewayToken(
  token: string,
  configService: ConfigService,
  keysService: KeysService,
): Promise<JWTPayload> {
  const privateKey = await importPKCS8(
    keysService.getPrivateKey(),
    'RSA-OAEP-256',
  );
  const { payload } = await jwtDecrypt(token, privateKey, {
    issuer: configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
    audience:
      configService.get<string>('JWT_AUDIENCE') ?? 'master-gateway-clients',
    keyManagementAlgorithms: ['RSA-OAEP-256'],
    contentEncryptionAlgorithms: ['A256GCM'],
  });

  return payload;
}
