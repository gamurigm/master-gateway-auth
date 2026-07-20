# Auditoría y depuración del pipeline CI/CD

Fecha de inicio: 2026-07-15

Este documento conserva la evidencia de los fallos encontrados durante la
validación del proyecto contra `PROY_PARCIAL_III_DesSeguro_202650.pdf` y de las
correcciones aplicadas. No contiene secretos ni valores sensibles.

## Flujo exigido por el PDF

En cada actualización de `main`, el flujo de producción debe ejecutar en orden:

1. compilación y pruebas unitarias;
2. análisis estático y Quality Gate;
3. SAST avanzado con un modelo ML sobre el código;
4. despliegue por CLI únicamente si los controles anteriores pasan.

La infraestructura debe recibir credenciales y claves desde GitHub Actions
Secrets. El repositorio no debe contener sus valores.

## Línea base local

Los comandos equivalentes al job `build-test` se ejecutaron desde una instalación
limpia con Node y npm:

| Verificación | Resultado |
| --- | --- |
| `npm ci` | Instalación completada; npm reportó 16 vulnerabilidades de dependencias (4 bajas, 6 moderadas y 6 altas) |
| Validación del esquema Prisma | Correcta |
| Generación de Prisma Client | Correcta |
| Build del backend | Correcto |
| Pruebas unitarias del backend | 57/57 correctas |
| Pruebas e2e del backend | 7/7 correctas |
| Build de Ventas | Correcto |
| Pruebas de Ventas | 6/6 correctas |
| Type check del frontend | Correcto |
| Build de Angular | Correcto |

La aplicación compila y sus pruebas existentes pasan. El primer fallo comprobado
estaba en la configuración de entrega, no en el job de build.

## Hallazgo 1: variables de despliegue ausentes

- Ejecución afectada: GitHub Actions `29263350764`, commit `97d0734`.
- Resultado observado: `build-test` y `sonarqube-community` pasaron;
  `codebert-sast` fue omitido; `deploy` falló.
- Paso exacto: `Configure Render database and environment`.
- Mensaje exacto del log: `JWE_SECRET is required`.
- Causa: el commit `c97105f` hizo obligatorios `JWE_SECRET` y
  `FRONTEND_ORIGIN`, pero el repositorio no tenía configurado el secreto ni la
  variable. GitHub entregó ambos valores vacíos al job.

### Corrección

- Se creó `FRONTEND_ORIGIN` como variable de GitHub Actions con el origen del
  frontend desplegado: `https://master-gateway-frontend.onrender.com`.
- Se generó un valor aleatorio nuevo de exactamente 32 bytes y se almacenó como
  GitHub Actions Secret `JWE_SECRET` mediante la API cifrada de GitHub.
- El valor del secreto no se imprimió ni se escribió en el repositorio.

## Hallazgo 2: el SAST ML no forma parte obligatoria de producción

El workflow actual omite `codebert-sast` en `main` cuando el Quality Gate devuelve
`OK`. Esto contradice el orden obligatorio del PDF: Sonar y CodeBERT son controles
complementarios y ambos deben pasar antes del despliegue. También permite que un
fallo técnico del análisis Sonar se convierta en una advertencia y no bloquee la
entrega.

### Corrección

- El análisis Sonar ya no usa `continue-on-error`.
- Un análisis fallido o un estado distinto de `OK` bloquea el job.
- En `main`, CodeBERT solo comienza después de que Sonar finaliza con Quality
  Gate `OK`; un cambio relevante no puede llegar a Render si CodeBERT fue
  omitido.
- Los cambios al propio workflow o a `sonar-project.properties` se consideran
  relevantes para seguridad, por lo que también ejercitan el SAST ML.

Estado: corregido; pendiente de validación en GitHub Actions.

## Hallazgo 3: vulnerabilidades en dependencias de producción

`npm audit --omit=dev` encontró cuatro avisos en el árbol que se despliega:
tres de severidad alta y uno moderado. Las cadenas vulnerables procedían de
`@nestjs/platform-express` hacia Multer y de `@nestjs/config` hacia Lodash.

### Corrección

- `@nestjs/platform-express`: `11.1.27` → `11.1.28`.
- `@nestjs/config`: `4.0.2` → `4.0.4`.
- Se regeneró `package-lock.json` sin usar actualizaciones mayores forzadas.
- `npm audit --omit=dev`: 0 vulnerabilidades después del cambio.
- Build del backend, 57 pruebas unitarias y 7 pruebas e2e: correctas.

## Registro de ejecuciones

| Ejecución | Commit | Resultado | Evidencia |
| --- | --- | --- | --- |
| `29263350764` | `97d0734` | Fallo | `JWE_SECRET is required`; Render no comenzó el despliegue |
| `29392183372` | `3766e88` | Éxito | La configuración reparada superó Render y desplegó por CLI |
| `29392266836` | `2e503b2` | Cancelada al quedar obsoleta | Sonar y CodeBERT pasaron; el deploy terminó antes de procesarse la cancelación |
| `29392718840` | `780f641` | Éxito | Build, pruebas, Quality Gate, CodeBERT y Render finalizaron correctamente |

Comprobación posterior al último despliegue:

- `GET https://master-gateway-auth.onrender.com/api/health`: `status=ok`.
- `GET https://master-gateway-auth.onrender.com/api/health/db`: `status=ok`,
  `database=postgresql`.

## Hallazgo 4: despliegues concurrentes fuera de orden

Los jobs de un commit nuevo podían adelantar a un commit anterior que todavía
estuviera ejecutando CodeBERT. Ambos terminaban invocando Render y la revisión
antigua podía desplegarse después de la nueva.

### Corrección

- Se añadió un grupo de concurrencia por workflow y rama con
  `cancel-in-progress: true`, de modo que un push nuevo cancela la ejecución
  obsoleta antes de publicar.
- El archivo se renombró a `.github/workflows/ci-cd.yml`, nombre solicitado en
  el anexo de infraestructura del PDF.

## Brechas de cumplimiento que permanecen

La depuración anterior deja funcional el pipeline, pero la revisión del proyecto
encontró diferencias adicionales frente al PDF que deben tratarse en una fase
posterior y no se presentan aquí como completadas:

1. El job usa una instancia efímera de SonarQube Community. El PDF nombra
   específicamente SonarCloud; migrarlo requiere crear/vincular el proyecto y
   configurar `SONAR_TOKEN` y la organización en GitHub.
2. `dev` está 14 commits detrás de `main` y `test` tiene divergencia. Además, los
   cambios históricos y esta depuración entraron directamente a `main`; para el
   modelo estricto del PDF se deben sincronizar las ramas y activar protección de
   `main` para aceptar únicamente Pull Requests desde `test`.
3. El frontend sí consume el árbol y registra rutas dinámicas, pero conserva
   rutas administrativas base y enlaces del sidebar escritos en código
   (`app-route-children.ts` y `shell.component.ts`). Esto no cumple literalmente
   la prohibición de rutas hardcodeadas.

## Segunda auditoría — rama `dev-cesar` (2026-07-20)

### Secretos versionados en `docker-compose.yml`

El propio agente SAST, tras extenderse a ficheros de configuración con la regla
`SECRET-IN-CONFIG` (CWE-798 / OWASP 2025 A07), detectó **cinco credenciales en
texto plano** en `docker-compose.yml`: `JWT_SECRET`, `JWE_SECRET`,
`TEMP_JWT_SECRET`, `REFRESH_JWT_SECRET` e `INTERNAL_API_KEY`, más
`SEED_ADMIN_PASSWORD`.

Ninguna regla anterior podía verlas por dos motivos: `.yml` no estaba en las
extensiones escaneadas, y los valores no eran placeholders `change-me-*`, de modo
que la regla `SECRET-PLACEHOLDER` tampoco aplicaba. Contradice directamente el
requisito del PDF de que queda "totalmente prohibido el hardcodeo de secrets".

**Corrección:** todos los valores pasan a indirección `${VAR:?mensaje}` leída
desde `.env` (ignorado por git). Se usa la forma `:?` en lugar de un valor por
defecto para que la ausencia de la variable impida arrancar el contenedor, en vez
de levantarlo con una clave conocida.

> [!WARNING]
> Los valores anteriores permanecen en el historial de git. Deben considerarse
> comprometidos y **rotarse**, no solo eliminarse del árbol de trabajo. Esta
> acción requiere intervención manual y queda pendiente.

### Autorización interna con guarda condicional

`auth.service.ts` comprobaba la API key interna como `if (expectedKey && apiKey
!== expectedKey)`. Con `INTERNAL_API_KEY` vacía o ausente, la condición era falsa
y **cualquier petición a `/api/internals/validate-token` pasaba la comprobación**.
`env.validation.ts` exige la variable, así que no era explotable en una
configuración válida, pero anulaba la defensa en profundidad.

**Corrección:** la comprobación pasa a `if (!expectedKey || apiKey !==
expectedKey)`, con una prueba de regresión que verifica el rechazo cuando la
variable no está definida.

### Validación de UUID inconsistente

`GET /api/roles/:id` era el único parámetro de ruta sin
`ParseUUIDPipe({ version: '4' })`. Corregido para alinearlo con el resto.

### CVEs de dependencias (OWASP 2025 A03 — Software Supply Chain Failures)

Los CVEs de Multer y Lodash citados en la primera auditoría ya no aparecen. El
estado actual pasó de 14 a 11 hallazgos:

| Acción | Efecto |
| --- | --- |
| `npm audit fix` | 14 → 13 |
| `@sonar/scan` 4 → 5 (major, herramienta de desarrollo) | 13 → 11, resuelve `adm-zip` y `@sonar/scan` (high) |

Las 11 restantes son **exclusivamente dependencias de desarrollo** y no llegan al
artefacto desplegado: `@angular-devkit/*`, `@angular/build`, `@babel/core`,
`@nestjs/cli`, `ajv`, `esbuild`, `glob`, `picomatch` y `webpack`. La mayoría
proviene del workspace `frontend` (Angular legado, ya sustituido por
`frontend-vue`), por lo que se resolverán al retirarlo. Resolverlas ahora exigiría
saltos de versión mayor en la toolchain, con más riesgo que beneficio.
