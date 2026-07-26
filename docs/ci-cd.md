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
pruebas. En Pull Requests y `test` analiza archivos modificados cuando hay
cambios de codigo; en `main` corre despues de SonarQube `OK` y es obligatorio
para permitir el deploy.

## GitHub Actions

El workflow `.github/workflows/ci.yml` ejecuta:

- Prisma validate.
- Build backend.
- Tests unitarios backend.
- Tests e2e backend.
- Build frontend (Vue 3).
- SonarQube Community en contenedores Docker solo en `main`.
- Espera y aplica el Quality Gate antes del despliegue; solo `OK` permite continuar.
- Ejecuta CodeBERT SAST despues de SonarQube en `main`; el deploy requiere SAST exitoso.
- Notifica por Telegram inicio de pipeline `main`, resultado del gate, alertas SAST y estado de deploy.

El runner levanta temporalmente `sonar-db` y `sonarqube:community`, genera un
token de analisis y destruye los contenedores al finalizar. Por eso este job no
requiere `SONAR_TOKEN` ni `SONAR_HOST_URL` en GitHub Secrets.

Secrets necesarios para la notificacion:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Secret | `TELEGRAM_BOT_TOKEN` | Token del bot |
| Secret | `TELEGRAM_CHAT_ID` | ID del chat destino |

La instancia del runner es efimera: sirve para bloquear el despliegue por el
Quality Gate actual, pero no conserva historial entre ejecuciones. Para mantener
metricas historicas se necesita un SonarQube persistente en un servidor propio.

## Limitacion de Community Build

SonarQube Community Build no soporta analisis multi-rama. Por eso el job
`sonarqube` se ejecuta solo en `push` a `main`; PR, `dev` y `test` mantienen
build y pruebas sin enviar analisis multi-rama. La rama `local` es solo para
validacion en maquina local y no dispara GitHub Actions.

## SonarQube Cloud

El pipeline no usa SonarQube Cloud. Un check externo con ese nombre proviene de
la aplicacion instalada en GitHub y no de este repositorio. Debe desactivarse en
`SonarQube Cloud > Project Settings > Analysis Method` o retirarse el acceso de
esa aplicacion al repositorio si se quiere que deje de aparecer en los PR.

## Referencias

- SonarQube Community Build con Docker: https://docs.sonarsource.com/sonarqube-community-build/server-installation/from-docker-image/set-up-and-start-container
- SonarScanner for NPM: https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/npm/using
- Imagen oficial Docker: https://hub.docker.com/_/sonarqube

