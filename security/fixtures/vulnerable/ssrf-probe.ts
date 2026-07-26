// FIXTURE VULNERABLE - CWE-918 (SSRF) - OWASP 2025 A01
// Regla esperada: TS-SSRF
// NO USAR EN PRODUCCION.
//
// Este es exactamente el antipatron que el endpoint real
// POST /api/external-services/probe debe evitar: permite alcanzar
// 169.254.169.254 (metadatos de la nube) o servicios internos.
import axios from 'axios';

export async function probeExternalService(req: { body: { baseUrl: string } }) {
  const response = await axios.get(req.body.baseUrl + '/health');
  return { reachable: true, status: response.status };
}

export async function fetchOpenApi(req: { query: { url: string } }) {
  return fetch(req.query.url).then((response) => response.json());
}
