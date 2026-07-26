"""Self-test del agente SAST contra los fixtures de security/fixtures.

Verifica dos cosas que el escaneo normal no puede verificar:

  1. RECALL   - cada fixture vulnerable dispara la regla que le corresponde.
  2. PRECISION - ningun fixture seguro produce hallazgos (falsos positivos).

Ejercita unicamente el motor de reglas, que es deterministico. La mitad ML del
agente depende de los pesos del modelo y de la version de transformers, asi que
un assert sobre su salida seria inestable en CI; se valida por separado con
`--path security/fixtures/vulnerable` en el escaneo real.

Exit 0 si todo pasa, 1 si hay algun fallo.
"""

from __future__ import annotations

import sys
from pathlib import Path

from codebert_sast import CONFIG_RULES, apply_rules, scan_rules
from cwe_catalog import lookup

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"

# fixture -> regla que DEBE dispararse
EXPECTED_VULNERABLE: dict[str, str] = {
    "sql-injection.ts": "TS-RAW-PRISMA",
    "eval-injection.ts": "TS-EVAL",
    "command-injection.ts": "TS-SHELL",
    "xss-dom-sink.ts": "TS-XSS",
    "path-traversal.ts": "TS-PATH-TRAVERSAL",
    "ssrf-probe.ts": "TS-SSRF",
    "missing-authorization.ts": "TS-MISSING-AUTHZ",
    "weak-crypto.ts": "TS-WEAK-CRYPTO",
    "insecure-random.ts": "TS-INSECURE-RANDOM",
    "hardcoded-secrets.ts": "SECRET-LITERAL",
    "insecure-deserialization.ts": "TS-DESERIALIZATION",
    "swallowed-error.ts": "TS-SWALLOWED-ERROR",
    "insecure-config.yml": "SECRET-IN-CONFIG",
}

SAFE_FIXTURES = [
    "parameterized-queries.ts",
    "strong-crypto.ts",
    "guarded-controller.ts",
]


def rules_for(path: Path) -> list:
    content = path.read_text(encoding="utf-8", errors="replace")
    if path.suffix.lower() in {".yml", ".yaml"} or path.name.startswith(".env"):
        return apply_rules(content, CONFIG_RULES, "CRITICAL")
    return scan_rules(content, path)


def check_recall() -> list[str]:
    failures: list[str] = []
    print("== RECALL: fixtures vulnerables ==")

    for filename, expected_rule in sorted(EXPECTED_VULNERABLE.items()):
        path = FIXTURES / "vulnerable" / filename
        if not path.exists():
            failures.append(f"{filename}: fixture no encontrado")
            print(f"  FALLO  {filename:34s} fixture no encontrado")
            continue

        found = rules_for(path)
        found_ids = {rule.rule_id for rule in found}
        entry = lookup(expected_rule)

        if expected_rule in found_ids:
            hit = next(rule for rule in found if rule.rule_id == expected_rule)
            print(
                f"  OK     {filename:34s} {entry.cwe_id:12s} "
                f"{entry.owasp_2025.split(' - ')[0]:10s} linea {hit.line}"
            )
        else:
            failures.append(f"{filename}: se esperaba {expected_rule}, se obtuvo {found_ids or 'nada'}")
            print(f"  FALLO  {filename:34s} esperaba {expected_rule}, obtuvo {found_ids or '{}'}")

    return failures


def check_precision() -> list[str]:
    failures: list[str] = []
    print("\n== PRECISION: fixtures seguros (no debe haber hallazgos) ==")

    for filename in SAFE_FIXTURES:
        path = FIXTURES / "safe" / filename
        if not path.exists():
            failures.append(f"{filename}: fixture no encontrado")
            print(f"  FALLO  {filename:34s} fixture no encontrado")
            continue

        found = rules_for(path)
        if found:
            detail = ", ".join(f"{rule.rule_id}:{rule.line}" for rule in found)
            failures.append(f"{filename}: falso positivo -> {detail}")
            print(f"  FALLO  {filename:34s} falso positivo: {detail}")
        else:
            print(f"  OK     {filename:34s} sin hallazgos")

    return failures


def main() -> int:
    if not FIXTURES.exists():
        print(f"No existe el directorio de fixtures: {FIXTURES}", file=sys.stderr)
        return 1

    failures = check_recall() + check_precision()

    total = len(EXPECTED_VULNERABLE) + len(SAFE_FIXTURES)
    passed = total - len(failures)
    covered_cwes = sorted({lookup(rule).cwe_id for rule in EXPECTED_VULNERABLE.values()})
    covered_owasp = sorted({lookup(rule).owasp_id for rule in EXPECTED_VULNERABLE.values()})

    print("\n== RESUMEN ==")
    print(f"  Casos: {passed}/{total}")
    print(f"  CWE cubiertos:   {', '.join(covered_cwes)}")
    print(f"  OWASP 2025:      {', '.join(covered_owasp)}")

    if failures:
        print(f"\nSELFTEST FALLIDO ({len(failures)} problema(s)):")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("\nSELFTEST OK: recall 100%, sin falsos positivos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
