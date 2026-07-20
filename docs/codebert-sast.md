# CodeBERT SAST dockerizado

El anexo del PDF pide un analisis SAST avanzado basado en ML, idealmente con un
modelo tipo CodeBERT. En este proyecto se implementa como un contenedor
independiente llamado `codebert-sast`.

## Modelo usado

Por defecto se usa:

```text
mrm8488/codebert-base-finetuned-detect-insecure-code
```

Ese modelo es CodeBERT fine-tuned para clasificacion binaria de codigo inseguro.
El contenedor permite cambiarlo con `CODEBERT_MODEL`.

Alternativa recomendada para TypeScript/JavaScript (menos falsos positivos):

```text
mahdin70/CodeBERT-PrimeVul-BigVul
```

Este modelo fue entrenado sobre BigVul + PrimeVul, que incluyen codigo JavaScript.
Se usa igual, solo cambiando la variable:

```powershell
wsl sh -lc 'CODEBERT_MODEL=mahdin70/CodeBERT-PrimeVul-BigVul docker compose --profile security run --rm codebert-sast --path backend/src/auth --warn-only'
```

## Ejecucion local con Docker en WSL

Desde PowerShell, como Docker esta dentro de WSL:

```powershell
wsl sh -lc 'docker compose --profile security build codebert-sast'
wsl sh -lc 'docker compose --profile security run --rm codebert-sast'
```

El reporte queda en:

```text
reports/codebert-sast.json
```

Primera ejecucion: puede tardar varios minutos porque descarga PyTorch,
Transformers y los pesos del modelo desde Hugging Face. Despues queda cacheado
en el volumen Docker `codebert-cache`.

## Escanear rutas especificas

```powershell
wsl sh -lc 'docker compose --profile security run --rm codebert-sast --path backend/src/auth --path backend/src/menus --report reports/codebert-sast-auth.json'
```

## Escanear archivos modificados

Crear un archivo con rutas relativas:

```text
backend/src/auth/auth.service.ts
frontend/src/app/core/auth.service.ts
```

Ejecutar:

```powershell
wsl sh -lc 'docker compose --profile security run --rm codebert-sast --changed-files reports/codebert-changed-files.txt'
```

## Taxonomia CWE / OWASP Top 10 : 2025

Cada regla se mapea a una debilidad CWE y a su categoria OWASP en la edicion
**2025**, junto con CVEs publicos de referencia y una remediacion concreta. El
mapa vive en `security/codebert-sast/cwe_catalog.py`.

| Regla | CWE | OWASP 2025 |
| --- | --- | --- |
| `TS-RAW-PRISMA` | CWE-89 SQL Injection | A05 Injection |
| `TS-EVAL` | CWE-95 Eval Injection | A05 Injection |
| `TS-SHELL` | CWE-78 OS Command Injection | A05 Injection |
| `TS-XSS` | CWE-79 Cross-site Scripting | A05 Injection |
| `TS-PATH-TRAVERSAL` | CWE-22 Path Traversal | A01 Broken Access Control |
| `TS-SSRF` | CWE-918 SSRF | A01 Broken Access Control |
| `TS-MISSING-AUTHZ` | CWE-862 Missing Authorization | A01 Broken Access Control |
| `TS-WEAK-CRYPTO` | CWE-327 Broken Cryptography | A04 Cryptographic Failures |
| `TS-INSECURE-RANDOM` | CWE-338 Weak PRNG | A04 Cryptographic Failures |
| `SECRET-*` | CWE-798 Hard-coded Credentials | A07 Authentication Failures |
| `AUTH-LOCAL-STORAGE` | CWE-522 Insufficiently Protected Credentials | A07 Authentication Failures |
| `TS-DESERIALIZATION` | CWE-502 Insecure Deserialization | A08 Data Integrity Failures |
| `TS-SWALLOWED-ERROR` | CWE-390 Error Without Action | A10 Mishandling of Exceptional Conditions |

> [!NOTE]
> Respecto a la edicion 2021: *Injection* pasa de A03 a **A05**, *SSRF* deja de ser
> categoria propia y se absorbe en **A01**, y aparecen **A03 Software Supply Chain
> Failures** y **A10 Mishandling of Exceptional Conditions**.

## Reportes generados

| Archivo | Contenido |
| --- | --- |
| `reports/codebert-sast.json` | Hallazgos con `cwe_id`, `owasp_2025`, `line`, `reference_cves`, `remediation` y bloque `summary` agregado |
| `reports/codebert-sast.md` | Informe legible: resumen ejecutivo, hallazgos por CWE, cobertura OWASP 2025 y detalle por archivo |

Los valores de secretos aparecen enmascarados (`<REDACTED:N chars>`): el reporte
viaja a artefactos de CI y a un grupo de Telegram, asi que filtrar el valor real
ampliaria la exposicion en vez de reducirla.

## Probar el agente con codigo vulnerable

`security/fixtures/` contiene 13 archivos deliberadamente vulnerables (uno por CWE
del catalogo) y 3 correctos. El self-test verifica **recall** (cada fixture
vulnerable dispara su regla) y **precision** (ningun fixture seguro genera
hallazgos):

```bash
npm run sast:selftest      # 16/16 casos
npm run sast:fixtures      # escanea los fixtures, debe salir con exit 1
npm run sast:rules         # escanea el repo real solo con reglas, sin descargar pesos
```

Los fixtures estan aislados por partida doble: `fixtures` esta en `EXCLUDED_DIRS`
del scanner y en `sonar.exclusions`. Sin ese aislamiento romperian el pipeline en
cada commit. Para analizarlos hay que pasar `--include-fixtures` explicitamente.

En CI lo ejecuta el job `codebert-selftest`, que ademas comprueba que el agente
devuelve exit code 1 sobre el codigo vulnerable.

## Suprimir un falso positivo

Cuando un hallazgo esta justificado se anota en el propio codigo:

```ts
// sast-ignore: TS-MISSING-AUTHZ los endpoints de liveness deben ser publicos
@Controller()
export class AppController {}
```

El marcador vale en la linea del hallazgo o en el bloque de comentarios contiguo
anterior. Sin este mecanismo, un unico falso positivo obligaria a desactivar la
regla en todo el repositorio.

## Criterio de fallo

El contenedor falla con exit code `1` si:

- CodeBERT predice probabilidad de codigo inseguro mayor o igual a
  `CODEBERT_THRESHOLD` (`0.85` por defecto).
- Se detecta una regla `CRITICAL`: inyeccion SQL/eval/shell, sinks DOM inseguros,
  path traversal, SSRF, criptografia debil, deserializacion insegura o un secreto
  hardcodeado en un fichero de configuracion.

Las reglas `WARNING` (localStorage, placeholders, catch vacio) se reportan pero no
bloquean el pipeline.

Modo solo-reglas, sin descargar los ~2 GB de pesos del modelo:

```bash
python security/codebert-sast/codebert_sast.py --rules-only
```

Se puede ejecutar solo como evidencia, sin bloquear:

```powershell
wsl sh -lc 'CODEBERT_WARN_ONLY=true docker compose --profile security run --rm codebert-sast'
```

## Uso en GitHub Actions

El workflow `.github/workflows/ci-cd.yml` construye la imagen y ejecuta el scanner
en Docker. En Pull Requests analiza solo archivos modificados; en `push` analiza
`backend/src`, `frontend/src` y `services`.

## Limitaciones

- El modelo no reemplaza SonarQube, ESLint, pruebas ni revision humana.
- CodeBERT trabaja con ventanas de 512 tokens; archivos grandes se dividen en
  fragmentos y se toma la mayor probabilidad.
- El modelo base (`mrm8488/codebert-base-finetuned-detect-insecure-code`) fue
  entrenado principalmente para C/C++, por lo que da falsos positivos en codigo
  TypeScript/NestJS con decorators. Por eso en CI se usa
  `mahdin70/CodeBERT-PrimeVul-BigVul` con threshold `0.85`.
- El motor de reglas CWE es deterministico y es lo que valida el self-test. La
  salida del modelo depende de sus pesos y de la version de `transformers`, asi
  que no se hacen asserts sobre ella en CI (seria inestable).
- El scanner tambien soporta modelos multi-task como
  `mahdin70/CodeBERT-PrimeVul-BigVul`, entrenado en BigVul + PrimeVul (incluye
  JavaScript), lo que reduce falsos positivos en JS/TS.
