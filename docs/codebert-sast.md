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

## Criterio de fallo

El contenedor falla con exit code `1` si:

- CodeBERT predice probabilidad de codigo inseguro mayor o igual a
  `CODEBERT_THRESHOLD` (`0.999` por defecto).
- Se detecta una regla critica, por ejemplo `eval`, `Function`, Prisma raw
  unsafe, shell execution o sinks DOM inseguros.

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
  TypeScript/NestJS con decorators. Se subio el threshold a 0.999 para mitigarlo.
- El scanner tambien soporta modelos multi-task como
  `mahdin70/CodeBERT-PrimeVul-BigVul`, entrenado en BigVul + PrimeVul (incluye
  JavaScript), lo que reduce falsos positivos en JS/TS.
