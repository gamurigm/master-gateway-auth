import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Defensa contra SSRF (CWE-918 / OWASP Top 10 : 2025 A01) para el probe de
 * servicios externos.
 *
 * El endpoint `POST /api/external-services/probe` hace una peticion saliente a
 * una URL que controla el usuario. Sin restricciones, un administrador (o
 * cualquiera que consiga su token) podria usar el Master como proxy para
 * alcanzar la red interna o el servicio de metadatos de la nube
 * (169.254.169.254), que suele exponer credenciales de la instancia.
 *
 * La validacion se hace sobre la IP RESUELTA, no sobre el hostname: un dominio
 * publico puede resolver deliberadamente a 127.0.0.1 (ataque conocido como
 * "DNS rebinding" en su variante mas simple).
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Rangos que nunca deben alcanzarse desde un probe en produccion. */
const BLOCKED_IPV4_RANGES: Array<{ cidr: string; reason: string }> = [
  { cidr: '0.0.0.0/8', reason: 'red actual' },
  { cidr: '10.0.0.0/8', reason: 'red privada' },
  { cidr: '100.64.0.0/10', reason: 'CGNAT' },
  { cidr: '127.0.0.0/8', reason: 'loopback' },
  { cidr: '169.254.0.0/16', reason: 'link-local / metadatos de la nube' },
  { cidr: '172.16.0.0/12', reason: 'red privada' },
  { cidr: '192.0.0.0/24', reason: 'reservado IETF' },
  { cidr: '192.168.0.0/16', reason: 'red privada' },
  { cidr: '198.18.0.0/15', reason: 'benchmarking' },
  { cidr: '224.0.0.0/4', reason: 'multicast' },
  { cidr: '240.0.0.0/4', reason: 'reservado' },
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function isInCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  // Con /0 el desplazamiento de 32 es indefinido en JS, pero ningun rango
  // bloqueado usa /0, asi que la mascara siempre queda bien definida.
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

function blockedReasonForIpv4(ip: string): string | null {
  const match = BLOCKED_IPV4_RANGES.find((range) => isInCidr(ip, range.cidr));
  return match ? match.reason : null;
}

function blockedReasonForIpv6(ip: string): string | null {
  const normalized = ip.toLowerCase();

  if (normalized === '::1' || normalized === '::') {
    return 'loopback';
  }
  // Direcciones IPv4 mapeadas: se evaluan como IPv4.
  //
  // Hay que cubrir las DOS formas, porque `new URL()` normaliza la notacion
  // decimal a hexadecimal: ::ffff:127.0.0.1 se convierte en ::ffff:7f00:1.
  // Mirar solo la decimal dejaba un bypass trivial del filtro de loopback.
  const mappedDecimal = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mappedDecimal?.[1]) {
    return blockedReasonForIpv4(mappedDecimal[1]);
  }

  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (mappedHex?.[1] && mappedHex[2]) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    const ipv4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
    return blockedReasonForIpv4(ipv4);
  }
  if (normalized.startsWith('fe80')) {
    return 'link-local';
  }
  // fc00::/7 (unique local): el primer byte es 0xfc o 0xfd.
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return 'red privada';
  }
  return null;
}

function allowsPrivateTargets(): boolean {
  return process.env['ALLOW_PRIVATE_PROBE_TARGETS'] === 'true';
}

export interface ValidatedTarget {
  url: URL;
  address: string;
}

/**
 * Valida la URL destino y devuelve la IP a la que resuelve.
 *
 * @throws BadRequestException si el destino no es alcanzable de forma segura.
 */
export async function assertSafeProbeTarget(rawUrl: string): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('La URL del servicio no es valida');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BadRequestException(
      `Protocolo no permitido: ${url.protocol}. Solo se admiten http y https`,
    );
  }

  // Las credenciales embebidas (http://user:pass@host) se usan para confundir
  // parsers y filtrar secretos hacia un tercero.
  if (url.username || url.password) {
    throw new BadRequestException('La URL no debe incluir credenciales');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let address = hostname;

  if (isIP(hostname) === 0) {
    try {
      const resolved = await lookup(hostname);
      address = resolved.address;
    } catch {
      throw new BadRequestException(`No se pudo resolver el host: ${hostname}`);
    }
  }

  if (allowsPrivateTargets()) {
    // En docker-compose y Kubernetes los servicios hijos viven precisamente en
    // rangos privados. Debe quedar en false en produccion.
    return { url, address };
  }

  const reason = isIP(address) === 6 ? blockedReasonForIpv6(address) : blockedReasonForIpv4(address);

  if (reason) {
    throw new BadRequestException(
      `El destino ${hostname} resuelve a una direccion restringida (${reason}). ` +
        'Se bloquea para prevenir SSRF. Si es un entorno interno, habilita ALLOW_PRIVATE_PROBE_TARGETS.',
    );
  }

  return { url, address };
}
