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

El workflow `.github/workflows/ci-cd.yml` ejecuta este scanner despues de build y
pruebas. En Pull Requests analiza archivos modificados; en `push` analiza las
rutas principales del proyecto.
## Estrategia de ramas y promocion

El repositorio aplica el flujo exigido por el anexo del proyecto:

```text
feature/* -> dev -> test -> main -> deploy
```

- Las ramas de trabajo abren Pull Requests hacia `dev`.
- Un pipeline exitoso en `dev` crea o reutiliza el PR `dev -> test` y activa auto-merge.
- Un pipeline exitoso en `test`, incluido CodeBERT cuando aplica, crea o reutiliza el PR
  `test -> main` y activa auto-merge.
- Un fallo, cancelacion, conflicto o check pendiente mantiene el PR abierto y bloquea la promocion.
- Solo el merge en `main` ejecuta SonarQube, los gates completos y el despliegue.

El job `branch-flow` rechaza PRs hacia `test` que no provengan de `dev` y PRs hacia
`main` que no provengan de `test`. El job estable `promotion-ready` agrega build, pruebas,
self-test y escaneos aplicables para usarlo como required status check.

### Configuracion requerida en GitHub

1. Habilitar `Allow auto-merge` y conservar habilitado el metodo `Merge commit`.
2. Crear un fine-grained Personal Access Token con acceso exclusivo a este repositorio y
   permisos `Contents: Read and write` y `Pull requests: Read and write`.
3. Guardarlo como Actions secret `BRANCH_PROMOTION_TOKEN`. Se usa un PAT dedicado porque los
   eventos creados con `GITHUB_TOKEN` no disparan el siguiente workflow de promocion.
4. Proteger `dev`, `test` y `main`: exigir Pull Request, exigir el check `promotion-ready`,
   bloquear force-push y bloquear eliminacion de rama.
5. No conceder bypass sobre `main`; el check `branch-flow` garantiza que su PR nazca de `test`.

Antes de activar la primera promocion hay que sincronizar las ramas historicamente divergentes.
Una vez alineadas, todo cambio nuevo debe entrar por una rama creada desde `dev`.

## GitHub Actions
El workflow `.github/workflows/ci-cd.yml` ejecuta:

- Prisma validate.
- Build backend.
- Tests unitarios backend.
- Tests e2e backend.
- Build y tests de `ventas`.
- Type check y build frontend.
- SonarQube Community en contenedores Docker solo en `main`.
- Espera y aplica el Quality Gate antes del despliegue.
- Notifica por Telegram el resultado `OK`, `ERROR` o `UNKNOWN` del gate.

El runner levanta temporalmente `sonar-db` y `sonarqube:community`, genera un
token de analisis y destruye los contenedores al finalizar. Por eso este job no
requiere `SONAR_TOKEN` ni `SONAR_HOST_URL` en GitHub Secrets.

Secrets necesarios para CI/CD:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Secret | `TELEGRAM_BOT_TOKEN` | Token del bot |
| Secret | `TELEGRAM_CHAT_ID` | ID del chat destino |
| Secret | `BRANCH_PROMOTION_TOKEN` | PAT dedicado para crear y fusionar PRs de promocion |

La instancia del runner es efimera: sirve para bloquear el despliegue por el
Quality Gate actual, pero no conserva historial entre ejecuciones. Para mantener
metricas historicas se necesita un SonarQube persistente en un servidor propio.

## Limitacion de Community Build

SonarQube Community Build no soporta analisis multi-rama. Por eso el job
`sonarqube` se ejecuta solo en `push` a `main`; PR, `dev` y `test` mantienen
build y pruebas sin enviar analisis multi-rama.

## SonarQube Cloud

El pipeline no usa SonarQube Cloud. Un check externo con ese nombre proviene de
la aplicacion instalada en GitHub y no de este repositorio. Debe desactivarse en
`SonarQube Cloud > Project Settings > Analysis Method` o retirarse el acceso de
esa aplicacion al repositorio si se quiere que deje de aparecer en los PR.

## Referencias

- SonarQube Community Build con Docker: https://docs.sonarsource.com/sonarqube-community-build/server-installation/from-docker-image/set-up-and-start-container
- SonarScanner for NPM: https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/npm/using
- Imagen oficial Docker: https://hub.docker.com/_/sonarqube
