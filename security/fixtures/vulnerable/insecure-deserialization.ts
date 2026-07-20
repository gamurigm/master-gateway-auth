// FIXTURE VULNERABLE - CWE-502 (Insecure Deserialization) - OWASP 2025 A08
// Regla esperada: TS-DESERIALIZATION
// NO USAR EN PRODUCCION.

type UserEntity = { id: string; email: string; estado: string; passwordHash: string };

export function applyUserUpdate(entity: UserEntity, req: { body: Record<string, unknown> }) {
  // Mass assignment: el cliente puede sobrescribir passwordHash o estado.
  Object.assign(entity, req.body);
  return entity;
}

export function hydrateSession(req: { body: { payload: string } }) {
  const serialize = require('node-serialize');
  return serialize.unserialize(req.body.payload);
}
