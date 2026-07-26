# Fixtures de prueba del agente SAST

Código **deliberadamente vulnerable** usado para validar que el agente CodeBERT detecta
lo que debe detectar, y código correcto para medir falsos positivos.

> [!WARNING]
> Nada de `vulnerable/` debe copiarse al código de producción. Son antipatrones a propósito.

## Cómo se aísla del escaneo normal

`fixtures` está en `EXCLUDED_DIRS` de `security/codebert-sast/codebert_sast.py`, así que el
escaneo por defecto del repositorio **nunca** los toca. Solo se analizan pasando
`--include-fixtures` explícitamente, que es lo que hace `selftest.py`. También están
excluidos en `sonar-project.properties`.

Sin esta doble salvaguarda los fixtures romperían el pipeline en cada commit.

## Estructura

| Fixture | CWE | OWASP 2025 | Regla esperada |
| --- | --- | --- | --- |
| `vulnerable/sql-injection.ts` | CWE-89 | A05 Injection | `TS-RAW-PRISMA` |
| `vulnerable/eval-injection.ts` | CWE-95 | A05 Injection | `TS-EVAL` |
| `vulnerable/command-injection.ts` | CWE-78 | A05 Injection | `TS-SHELL` |
| `vulnerable/xss-dom-sink.ts` | CWE-79 | A05 Injection | `TS-XSS` |
| `vulnerable/path-traversal.ts` | CWE-22 | A01 Broken Access Control | `TS-PATH-TRAVERSAL` |
| `vulnerable/ssrf-probe.ts` | CWE-918 | A01 Broken Access Control | `TS-SSRF` |
| `vulnerable/missing-authorization.ts` | CWE-862 | A01 Broken Access Control | `TS-MISSING-AUTHZ` |
| `vulnerable/weak-crypto.ts` | CWE-327 | A04 Cryptographic Failures | `TS-WEAK-CRYPTO` |
| `vulnerable/insecure-random.ts` | CWE-338 | A04 Cryptographic Failures | `TS-INSECURE-RANDOM` |
| `vulnerable/hardcoded-secrets.ts` | CWE-798 | A07 Authentication Failures | `SECRET-LITERAL` |
| `vulnerable/insecure-deserialization.ts` | CWE-502 | A08 Data Integrity Failures | `TS-DESERIALIZATION` |
| `vulnerable/swallowed-error.ts` | CWE-390 | A10 Mishandling of Exceptional Conditions | `TS-SWALLOWED-ERROR` |
| `vulnerable/insecure-config.yml` | CWE-798 | A07 Authentication Failures | `SECRET-IN-CONFIG` |

`safe/` contiene las contrapartes correctas de tres de los casos anteriores. Ninguna debe
producir un hallazgo: si alguna lo hace, es un falso positivo y `selftest.py` falla.

## Ejecución

```bash
npm run sast:selftest
```
