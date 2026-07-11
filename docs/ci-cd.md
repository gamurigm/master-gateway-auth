# CI/CD local con SonarQube Community

## SonarQube en Docker/WSL

El proyecto incluye SonarQube Community en `docker-compose.yml`.

```powershell
wsl -e docker compose up -d sonar-db sonarqube
```

Por defecto queda disponible en:

```text
http://localhost:9000
```

Credenciales iniciales de SonarQube:

```text
admin / admin
```

Si ya tienes un SonarQube en WSL, como `sonarqube:9.9-community` publicado en `http://localhost:9090`, puedes usar ese servidor sin levantar el servicio nuevo:

```powershell
$env:SONAR_HOST_URL = "http://localhost:9090"
```

Si el contenedor no arranca por Elasticsearch en WSL, ejecuta dentro de tu distro:

```bash
sudo sysctl -w vm.max_map_count=262144
```

## Crear proyecto y token

1. Entra a SonarQube.
2. Cambia la clave inicial de `admin`.
3. Crea un proyecto manual con key:

```text
master-gateway
```

4. Genera un token de analisis para el proyecto.

En PowerShell:

```powershell
$env:SONAR_HOST_URL = "http://localhost:9000"
$env:SONAR_TOKEN = "<token-generado>"
```

## Ejecutar CI local

```powershell
npm ci
npm run prisma:validate
npm run lint
npm run test
npm run test:e2e -w backend
npm run build
npm run test:coverage
npm run sonar:scan
```

El scanner lee `sonar-project.properties` y espera el Quality Gate con:

```properties
sonar.qualitygate.wait=true
```

## CodeBERT SAST dockerizado

El proyecto integra el requisito de SAST avanzado/ML con un contenedor Docker:

```powershell
wsl sh -lc 'docker compose --profile security build codebert-sast'
wsl sh -lc 'docker compose --profile security run --rm codebert-sast'
```

El contenedor usa por defecto el modelo:

```text
mrm8488/codebert-base-finetuned-detect-insecure-code
```

Este modelo es CodeBERT fine-tuned para clasificacion de codigo inseguro. El
scanner divide archivos grandes en fragmentos de 512 tokens, calcula la mayor
probabilidad de riesgo y escribe `reports/codebert-sast.json`.

Variables utiles:

| Variable | Uso |
| --- | --- |
| `CODEBERT_MODEL` | Cambia el modelo Hugging Face o una ruta local montada en Docker |
| `CODEBERT_THRESHOLD` | Umbral de bloqueo, por defecto `0.85` |
| `CODEBERT_WARN_ONLY` | Si es `true`, genera reporte pero no falla el proceso |

El workflow `.github/workflows/ci.yml` ejecuta este scanner despues de build y
pruebas. En Pull Requests analiza archivos modificados; en `push` analiza las
rutas principales del proyecto.
## GitHub Actions

El workflow `.github/workflows/ci.yml` ejecuta:

- Prisma validate.
- Build backend.
- Tests unitarios backend.
- Tests e2e backend.
- Build y tests de `ventas`.
- Type check y build frontend.
- Analisis SonarQube solo en `main`.

Variables necesarias en GitHub:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Secret | `SONAR_TOKEN` | Token generado en SonarQube |
| Variable | `SONAR_HOST_URL` | URL publica del servidor SonarQube |

Nota importante: si SonarQube vive solo en Docker/WSL local, GitHub-hosted runners no pueden acceder a `localhost`. Para usar ese SonarQube local desde GitHub Actions necesitas un runner self-hosted en tu maquina/WSL o publicar temporalmente el servidor mediante una URL accesible.

## Limitacion de Community Build

SonarQube Community Build no soporta analisis multi-rama. Por eso el job `sonar` se ejecuta solo en `push` a `main`; PR, `dev` y `test` mantienen build y pruebas sin enviar analisis multi-rama.

## Referencias

- SonarQube Community Build con Docker: https://docs.sonarsource.com/sonarqube-community-build/server-installation/from-docker-image/set-up-and-start-container
- SonarScanner for NPM: https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/npm/using
- Imagen oficial Docker: https://hub.docker.com/_/sonarqube

