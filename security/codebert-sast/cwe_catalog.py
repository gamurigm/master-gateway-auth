"""Catalogo CWE / OWASP Top 10 : 2025 para el agente SAST del Master Gateway.

Cada regla del escaner se mapea a una debilidad CWE, a su categoria en el
OWASP Top 10 en su edicion 2025 y a CVEs publicos de referencia que ilustran
el impacto real de esa debilidad en el ecosistema Node/TypeScript.

Nota sobre la edicion 2025: respecto a 2021 cambian varias categorias que
afectan directamente a este proyecto.

  - Injection baja de A03 a A05.
  - SSRF deja de ser categoria propia (era A10) y se absorbe en A01.
  - Cryptographic Failures pasa de A02 a A04.
  - Entra A03 Software Supply Chain Failures (cubre los CVEs de dependencias).
  - Entra A10 Mishandling of Exceptional Conditions.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

OWASP_VERSION = "2025"

OWASP_2025 = {
    "A01": "A01:2025 - Broken Access Control",
    "A02": "A02:2025 - Security Misconfiguration",
    "A03": "A03:2025 - Software Supply Chain Failures",
    "A04": "A04:2025 - Cryptographic Failures",
    "A05": "A05:2025 - Injection",
    "A06": "A06:2025 - Insecure Design",
    "A07": "A07:2025 - Authentication Failures",
    "A08": "A08:2025 - Software or Data Integrity Failures",
    "A09": "A09:2025 - Logging and Alerting Failures",
    "A10": "A10:2025 - Mishandling of Exceptional Conditions",
}


@dataclass(frozen=True)
class CweEntry:
    cwe_id: str
    cwe_name: str
    owasp_id: str
    cvss_hint: float
    reference_cves: tuple[str, ...]
    remediation: str

    @property
    def owasp_2025(self) -> str:
        return OWASP_2025[self.owasp_id]

    def as_dict(self) -> dict:
        data = asdict(self)
        data["reference_cves"] = list(self.reference_cves)
        data["owasp_2025"] = self.owasp_2025
        return data


CATALOG: dict[str, CweEntry] = {
    "TS-RAW-PRISMA": CweEntry(
        "CWE-89",
        "Improper Neutralization of Special Elements used in an SQL Command",
        "A05",
        9.8,
        ("CVE-2023-22579",),
        "Usar Prisma con argumentos tipados o tagged templates ($queryRaw`...`), nunca $queryRawUnsafe.",
    ),
    "TS-EVAL": CweEntry(
        "CWE-95",
        "Improper Neutralization of Directives in Dynamically Evaluated Code (Eval Injection)",
        "A05",
        9.3,
        ("CVE-2021-23383",),
        "Eliminar eval/new Function. Usar un parser explicito o un mapa de handlers permitidos.",
    ),
    "TS-SHELL": CweEntry(
        "CWE-78",
        "Improper Neutralization of Special Elements used in an OS Command",
        "A05",
        9.8,
        ("CVE-2021-21315",),
        "Usar execFile/spawn con array de argumentos y shell:false. Nunca interpolar entrada del usuario.",
    ),
    "TS-XSS": CweEntry(
        "CWE-79",
        "Improper Neutralization of Input During Web Page Generation (Cross-site Scripting)",
        "A05",
        8.2,
        ("CVE-2024-21501",),
        "Usar textContent o el binding del framework. Sanitizar con DOMPurify si el HTML es imprescindible.",
    ),
    "TS-PATH-TRAVERSAL": CweEntry(
        "CWE-22",
        "Improper Limitation of a Pathname to a Restricted Directory (Path Traversal)",
        "A01",
        7.5,
        ("CVE-2022-24434",),
        "Normalizar con path.resolve y verificar que el resultado siga dentro del directorio base permitido.",
    ),
    "TS-SSRF": CweEntry(
        "CWE-918",
        "Server-Side Request Forgery (SSRF)",
        "A01",
        8.6,
        ("CVE-2023-45857",),
        "Validar esquema, resolver DNS y bloquear rangos privados/loopback/link-local antes de la peticion.",
    ),
    "TS-MISSING-AUTHZ": CweEntry(
        "CWE-862",
        "Missing Authorization",
        "A01",
        7.1,
        ("CVE-2023-26118",),
        "Aplicar @UseGuards(JwtAuthGuard, RolesGuard) y @RequireRoles en cada controlador expuesto.",
    ),
    "TS-WEAK-CRYPTO": CweEntry(
        "CWE-327",
        "Use of a Broken or Risky Cryptographic Algorithm",
        "A04",
        7.4,
        ("CVE-2023-46809",),
        "Sustituir MD5/SHA1/DES por SHA-256+ y AES-GCM. Para contrasenas usar argon2id.",
    ),
    "TS-INSECURE-RANDOM": CweEntry(
        "CWE-338",
        "Use of Cryptographically Weak Pseudo-Random Number Generator (PRNG)",
        "A04",
        7.5,
        ("CVE-2023-30533",),
        "Usar crypto.randomUUID() o crypto.randomBytes() para tokens, OTP y nonces.",
    ),
    "AUTH-LOCAL-STORAGE": CweEntry(
        "CWE-522",
        "Insufficiently Protected Credentials",
        "A07",
        6.5,
        (),
        "Preferir cookies httpOnly + SameSite=Strict para el refresh token.",
    ),
    "SECRET-PLACEHOLDER": CweEntry(
        "CWE-798",
        "Use of Hard-coded Credentials",
        "A07",
        9.8,
        ("CVE-2022-31163",),
        "Inyectar por variables de entorno o gestor de secretos. Nunca versionar el valor.",
    ),
    "SECRET-LITERAL": CweEntry(
        "CWE-798",
        "Use of Hard-coded Credentials",
        "A07",
        9.8,
        ("CVE-2022-31163",),
        "Inyectar por variables de entorno o gestor de secretos. Nunca versionar el valor.",
    ),
    "SECRET-IN-CONFIG": CweEntry(
        "CWE-798",
        "Use of Hard-coded Credentials",
        "A07",
        9.8,
        ("CVE-2022-31163",),
        "Mover el valor a .env (ignorado por git) y referenciarlo con ${VAR}. Rotar si ya fue versionado.",
    ),
    "TS-DESERIALIZATION": CweEntry(
        "CWE-502",
        "Deserialization of Untrusted Data",
        "A08",
        9.8,
        ("CVE-2023-37903",),
        "Validar con class-validator/zod antes de materializar. Nunca Object.assign sobre req.body crudo.",
    ),
    "TS-SWALLOWED-ERROR": CweEntry(
        "CWE-390",
        "Detection of Error Condition Without Action",
        "A10",
        5.3,
        (),
        "Registrar el error y propagar una excepcion adecuada. Un catch vacio oculta fallos de seguridad.",
    ),
    "ML-ANOMALY": CweEntry(
        "CWE-noinfo",
        "Anomalia detectada por el modelo de mineria de datos (patron sin regla estatica asociada)",
        "A06",
        0.0,
        (),
        "Revision manual: el modelo detecto un patron similar a vulnerabilidades del dataset de entrenamiento.",
    ),
    "DEP-VULNERABLE": CweEntry(
        "CWE-1395",
        "Dependency on Vulnerable Third-Party Component",
        "A03",
        0.0,
        (),
        "Actualizar la dependencia a una version parcheada (npm audit fix) o aplicar un override.",
    ),
}


def lookup(rule_id: str) -> CweEntry:
    """Devuelve la entrada del catalogo, con un fallback seguro si la regla es nueva."""
    return CATALOG.get(
        rule_id,
        CweEntry("CWE-noinfo", "Debilidad no clasificada", "A06", 0.0, (), "Revision manual requerida."),
    )


def enrich(rule_id: str) -> dict:
    """Campos CWE/OWASP listos para inyectar en el JSON del reporte."""
    entry = lookup(rule_id)
    return {
        "cwe_id": entry.cwe_id,
        "cwe_name": entry.cwe_name,
        "owasp_2025": entry.owasp_2025,
        "owasp_id": entry.owasp_id,
        "cvss_hint": entry.cvss_hint,
        "reference_cves": list(entry.reference_cves),
        "remediation": entry.remediation,
    }
