// FIXTURE SEGURO - contraparte correcta de vulnerable/weak-crypto.ts
// e insecure-random.ts. No debe producir ningun hallazgo.
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';

export function hashPassword(password: string) {
  // Hash lento y adaptativo, con factor de costo.
  return argon2.hash(password, { type: argon2.argon2id });
}

export function fingerprint(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function generateResetToken() {
  return randomBytes(32).toString('base64url');
}

export function sessionNonce() {
  return randomUUID();
}
