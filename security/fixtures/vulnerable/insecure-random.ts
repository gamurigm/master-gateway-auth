// FIXTURE VULNERABLE - CWE-338 (Weak PRNG) - OWASP 2025 A04
// Regla esperada: TS-INSECURE-RANDOM
// NO USAR EN PRODUCCION.

export function generateResetToken() {
  // Math.random() es predecible: un atacante puede reconstruir la secuencia.
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return token;
}

export function generateOtp() {
  const otp = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return otp;
}

export function sessionNonce() {
  const nonce = Math.random().toString(16);
  return nonce;
}
