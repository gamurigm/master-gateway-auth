// FIXTURE VULNERABLE - CWE-22 (Path Traversal) - OWASP 2025 A01
// Regla esperada: TS-PATH-TRAVERSAL
// NO USAR EN PRODUCCION.
import { readFileSync } from 'fs';
import path from 'path';

const UPLOADS = '/var/app/uploads';

export function downloadAttachment(req: { query: { file: string } }) {
  // "../../etc/passwd" escapa del directorio base sin ninguna validacion.
  const target = path.join(UPLOADS, req.query.file);
  return readFileSync(target);
}

export function readReport(req: { params: { name: string } }) {
  return readFileSync(path.resolve(UPLOADS, req.params.name), 'utf-8');
}
