// FIXTURE VULNERABLE - CWE-798 (Hard-coded Credentials) - OWASP 2025 A07
// Regla esperada: SECRET-LITERAL
// NO USAR EN PRODUCCION. Ninguno de estos valores es real ni ha sido usado.

export const config = {
  jwtSecret: 'S3cr3tJwtK3yF1xtur3Only',
  databasePassword: 'Fixtur3DbP4ssw0rd!',
  internalApiKey: 'fixture-internal-api-key-0123456789',
};

export function buildAuthHeader() {
  const token = 'Bearer fixture-static-token-abcdef0123456789';
  return { Authorization: token };
}
