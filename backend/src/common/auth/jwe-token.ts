import { ConfigService } from '@nestjs/config';
import { jwtDecrypt, JWTPayload } from 'jose';

export async function decryptGatewayToken(
  token: string,
  configService: ConfigService,
): Promise<JWTPayload> {
  const jweSecret = configService.get<string>('JWE_SECRET');
  if (!jweSecret) {
    throw new Error('JWE_SECRET no configurado');
  }

  const { payload } = await jwtDecrypt(
    token,
    new TextEncoder().encode(jweSecret),
    {
      issuer: configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
      audience:
        configService.get<string>('JWT_AUDIENCE') ?? 'master-gateway-clients',
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    },
  );

  return payload;
}
