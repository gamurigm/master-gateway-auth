// FIXTURE VULNERABLE - CWE-78 (OS Command Injection) - OWASP 2025 A05
// Regla esperada: TS-SHELL
// NO USAR EN PRODUCCION.
import { exec, execSync } from 'child_process';

export function backupDatabase(databaseName: string) {
  // El nombre llega por HTTP y se interpola en un comando de shell.
  return execSync(`pg_dump ${databaseName} > /tmp/${databaseName}.sql`);
}

export function pingService(host: string, done: (out: string) => void) {
  exec(`ping -c 1 ${host}`, { shell: true }, (_error, stdout) => done(stdout));
}
