// FIXTURE VULNERABLE - CWE-390 (Error Condition Without Action) - OWASP 2025 A10
// Regla esperada: TS-SWALLOWED-ERROR
// NO USAR EN PRODUCCION.

export async function verifyToken(token: string, verifier: (value: string) => Promise<boolean>) {
  try {
    await verifier(token);
  } catch {}
  // El catch vacio hace que un token invalido siga el camino feliz.
  return { valid: true };
}

export function auditLogin(userId: string, writer: (id: string) => void) {
  try {
    writer(userId);
  } catch (error) {}
}
