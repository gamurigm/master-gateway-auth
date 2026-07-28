import { ConfigService } from '@nestjs/config';
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { KeysService } from '../keys/keys.service';

/**
 * Emision y verificacion de los tokens del Gateway.
 *
 * IMPORTANTE — por que se FIRMA y no se CIFRA:
 *
 * La version anterior emitia los tokens como JWE con `alg: RSA-OAEP-256`, es
 * decir, cifrados con la clave PUBLICA. En RSA-OAEP la clave que cifra es la
 * publica, y esta se sirve sin proteccion en `GET /api/auth/public-key` y en
 * `/.well-known/jwks.json`. Cualquiera podia descargarla y fabricar un token
 * con `roleName: "SUPER_ADMIN"`: el Master lo descifraba con exito y lo
 * aceptaba, porque cifrar da CONFIDENCIALIDAD pero no AUTENTICIDAD del emisor
 * (CWE-347). Era un bypass total de autenticacion y autorizacion.
 *
 * Ahora se firma con JWS RS256 usando la clave PRIVADA. Solo el Master puede
 * emitir; cualquiera puede verificar con la publica. Eso es exactamente la
 * "validacion asimetrica" que describe el PDF (§6.1.b): un microservicio hijo
 * valida la firma sin hablar con el Master, y la clave publica puede seguir
 * siendo publica sin riesgo.
 */

/** Unico algoritmo aceptado. Fijarlo evita ataques de confusion de algoritmo
 * (`alg: none`, o RS256 -> HS256 usando la clave publica como secreto HMAC). */
export const GATEWAY_TOKEN_ALGORITHM = 'RS256';

/**
 * Distingue el access token del refresh token.
 *
 * Sin este claim ambos tokens son intercambiables: el refresh (7 dias) servia
 * como access y alargaba la ventana de compromiso de 15 minutos a una semana.
 */
export type TokenUse = 'access' | 'refresh';

export interface GatewayTokenClaims extends JWTPayload {
  sub: string;
  jti: string;
  roleId: string;
  roleName: string;
  token_use: TokenUse;
  /** Permisos del rol elegido (menor privilegio, §6.2). Solo en el access. */
  permissions?: string[];
}

function issuerOf(configService: ConfigService): string {
  return configService.get<string>('JWT_ISSUER') ?? 'master-gateway';
}

function audienceOf(configService: ConfigService): string {
  return configService.get<string>('JWT_AUDIENCE') ?? 'master-gateway-clients';
}

export interface SignGatewayTokenInput {
  sub: string;
  jti: string;
  roleId: string;
  roleName: string;
  tokenUse: TokenUse;
  permissions?: string[];
  expiresIn: string;
}

/** Firma un token del Gateway con la clave privada (solo el Master puede). */
export async function signGatewayToken(
  input: SignGatewayTokenInput,
  configService: ConfigService,
  keysService: KeysService,
): Promise<string> {
  const privateKey = await importPKCS8(
    keysService.getPrivateKey(),
    GATEWAY_TOKEN_ALGORITHM,
  );

  const claims: Record<string, unknown> = {
    sub: input.sub,
    jti: input.jti,
    roleId: input.roleId,
    roleName: input.roleName,
    token_use: input.tokenUse,
  };

  // El refresh no lleva permisos: no se usa para autorizar, y asi no queda una
  // copia de los permisos congelada durante 7 dias.
  if (input.tokenUse === 'access') {
    claims['permissions'] = input.permissions ?? [];
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: GATEWAY_TOKEN_ALGORITHM, typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(input.expiresIn)
    .setIssuer(issuerOf(configService))
    .setAudience(audienceOf(configService))
    .sign(privateKey);
}

/**
 * Verifica la firma, el emisor, la audiencia, la expiracion y el uso del token.
 *
 * @param expectedUse si se indica, el token debe declarar ese `token_use`.
 * @throws si la firma no es valida o el token no cumple alguna restriccion.
 */
export async function verifyGatewayToken(
  token: string,
  configService: ConfigService,
  keysService: KeysService,
  expectedUse?: TokenUse,
): Promise<GatewayTokenClaims> {
  const publicKey = await importSPKI(
    keysService.getPublicKey(),
    GATEWAY_TOKEN_ALGORITHM,
  );

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: issuerOf(configService),
    audience: audienceOf(configService),
    algorithms: [GATEWAY_TOKEN_ALGORITHM],
  });

  const claims = payload as GatewayTokenClaims;

  if (!claims.sub || !claims.jti || !claims.roleId) {
    throw new Error('Token del Gateway incompleto');
  }

  if (expectedUse && claims.token_use !== expectedUse) {
    throw new Error(
      `Se esperaba un token de tipo ${expectedUse} y llego ${String(claims.token_use)}`,
    );
  }

  return claims;
}
