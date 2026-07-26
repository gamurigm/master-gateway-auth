// FIXTURE SEGURO - contraparte correcta de vulnerable/sql-injection.ts
// No debe producir ningun hallazgo.
import { PrismaClient, Estado } from '@prisma/client';

const prisma = new PrismaClient();

export async function findUserByEmail(email: string) {
  // Prisma parametriza internamente: no hay concatenacion de cadenas.
  return prisma.user.findFirst({ where: { email, estado: Estado.ACTIVO } });
}

export async function deactivateRole(roleName: string) {
  return prisma.role.updateMany({
    where: { name: roleName },
    data: { estado: Estado.INACTIVO },
  });
}
