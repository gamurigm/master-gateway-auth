// FIXTURE VULNERABLE - CWE-89 (SQL Injection) - OWASP 2025 A05
// Regla esperada: TS-RAW-PRISMA
// NO USAR EN PRODUCCION.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function findUserByEmail(email: string) {
  // El email viene del cliente y se concatena directamente en la consulta.
  return prisma.$queryRawUnsafe(`SELECT * FROM usuarios WHERE email = '${email}'`);
}

export async function deactivateRole(roleName: string) {
  return prisma.$executeRawUnsafe(
    `UPDATE roles SET estado = 'INACTIVO' WHERE nombre = '${roleName}'`,
  );
}
