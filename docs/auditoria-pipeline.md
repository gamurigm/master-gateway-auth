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

Esta sección se actualizará después de cada push relevante para conservar el ID,
el resultado y el siguiente fallo real encontrado.
