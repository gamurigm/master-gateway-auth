// FIXTURE VULNERABLE - CWE-327 (Broken Cryptography) - OWASP 2025 A04
// Regla esperada: TS-WEAK-CRYPTO
// NO USAR EN PRODUCCION.
import { createCipheriv, createHash } from 'crypto';

export function hashPassword(password: string) {
  // MD5 es reversible por tablas rainbow y no tiene factor de costo.
  return createHash('md5').update(password).digest('hex');
}

export function fingerprint(token: string) {
  return createHash('sha1').update(token).digest('hex');
}

export function encryptPayload(payload: string, key: Buffer, iv: Buffer) {
  const cipher = createCipheriv('des-ede3-cbc', key, iv);
  return cipher.update(payload, 'utf8', 'hex') + cipher.final('hex');
}
