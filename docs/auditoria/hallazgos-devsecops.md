# Auditoría DevSecOps — Master Gateway (solo lectura)

Auditor: DevSecOps. Alcance: infraestructura y pipeline en `D:\master-gateway-auth`.
Repo remoto: `origin` (GitHub). Rama de trabajo: `dev-cesar` (== HEAD 921d72d). Rama desplegable: `main`.
Fecha: 2026-07-24.

Formato de cada hallazgo: **Título** | Severidad | Archivo/comando:línea | Riesgo | Recomendación.

---

## Hallazgos

### H1. Secretos REALES de producción persisten en el historial de git
- **Severidad:** ALTA (CRÍTICA si el repositorio es público).
- **Archivo/comando:** `git show 3490d75:docker-compose.yml`; introducidos en `3490d75` / `a4029bb`, eliminados del árbol en `c0be76e`. Verificado alcanzable desde `origin/main`:
  `git log --oneline origin/main -S "GRLBr1NlXycv635hnQ2ZdxaT9uSHb7VpjFtso4Dk" -- docker-compose.yml` → devuelve `c0be76e` y `3490d75`.
- **Evidencia (valores quemados, recuperables por cualquiera con acceso al repo):**
  ```
  JWT_SECRET:          7xKpLmNqRsTvWzY2A4C6E8G0JbDfHjMw
  JWE_SECRET:          ZnDwNgatMrdmOf3GeviysWbVJLTI2qFc  (variante larga ...kKBjQ5SPYuHCz6AXE4hxoUl9018Rp7)
  TEMP_JWT_SECRET:     RvYz3B5D7F9H1J3L5N7P9R0T2V4W6X8Z
  REFRESH_JWT_SECRET:  aBcDeFgHiJkLmNoPqRsTuVwXyZ0_2=4+6-8
  INTERNAL_API_KEY:    GRLBr1NlXycv635hnQ2ZdxaT9uSHb7VpjFtso4Dk
  SEED_ADMIN_PASSWORD: Admin12345!
  ```
  El propio commit `c0be76e` lo admite: *"Los valores siguen en el historial de git y deben ROTARSE (documentado)."* Hubo incluso una "rotación" previa (`a4029bb`, de `local-docker-*` a estos valores) que **no purgó** los anteriores: ambas generaciones siguen en el historial.
- **Riesgo:** Quien clone el repo firma/valida JWT-JWE, se autentica como servicio interno (`INTERNAL_API_KEY` = bypass Zero-Trust hacia `/api/internals/validate-token`) y entra como admin (`Admin12345!`). Si estos valores siguen cargados en GitHub Secrets/Render, es compromiso directo de producción.
- **Recomendación:** (1) ROTAR YA los 6 secretos en GitHub Secrets y en Render (generar nuevos con `crypto.randomBytes`). (2) Purgar el historial (`git filter-repo`/BFG) y forzar push, o asumir la fuga como permanente tras rotar. (3) Confirmar que la clave de firma actual es el par RSA (no estos symmetric secrets) — ver H12.

### H2. Ruta de despliegue que EVADE todos los gates de seguridad
- **Severidad:** ALTA.
- **Archivo:** `.github/workflows/deploy-render-test.yml:1-58` y `deploy-frontend-test.yml:1-71`.
- **Evidencia:** Ambos workflows disparan en `push` a `deploy/render-test` / `deploy/frontend-test` (ramas que existen en `origin`) y ejecutan `render deploys create "$RENDER_SERVICE_ID" --confirm --wait --commit "$github.sha"` **sin** build, tests, SonarQube ni CodeBERT. Usan el **mismo** `RENDER_SERVICE_ID` y secretos de producción que el pipeline principal (el nombre "test" es engañoso: golpea la infra real).
- **Riesgo:** Cualquiera que pueda hacer push a esas ramas despliega commit arbitrario a producción saltándose el Quality Gate y el SAST. Anula el control central del anexo.
- **Recomendación:** Proteger esas ramas (branch protection + revisores) o eliminarlas; si se conservan como atajo operativo, exigir al menos `needs:` de build-test/SAST, o restringirlas a un servicio Render separado y no productivo.

### H3. `docker-compose.yml` (HEAD) arranca en "producción" con credenciales conocidas
- **Severidad:** MEDIA-ALTA.
- **Archivo:** `docker-compose.yml:113,122,125,195` (HEAD 921d72d).
- **Evidencia:** `NODE_ENV: production` fijo (línea 113) junto a `INTERNAL_API_KEY: ${INTERNAL_API_KEY:-local-docker-internal-key}` (122) y `SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD:-Admin12345!}` (125). El commit `c0be76e` había endurecido esto a `${VAR:?falta...}` (falla si no está la variable); el HEAD `921d72d` lo **revirtió** a `:-` con defaults débiles (`git show 921d72d -- docker-compose.yml`). `env.validation.ts:41-43` sólo rechaza secretos que empiezan por `change-me`, así que **no** bloquea `Admin12345!` ni `local-docker-internal-key`.
- **Riesgo:** `docker compose up` levanta un backend marcado como producción con admin y clave interna públicas y predecibles; el guard de arranque no lo detiene.
- **Recomendación:** Volver a `${VAR:?}` para `SEED_ADMIN_PASSWORD` e `INTERNAL_API_KEY`, o ampliar `env.validation` para rechazar también estos literales conocidos en `production`.

### H4. Kong Admin API expuesta en 0.0.0.0 y publicada al host sin autenticación
- **Severidad:** MEDIA-ALTA.
- **Archivo:** `docker-compose.yml:71,76-77` (`KONG_ADMIN_LISTEN: 0.0.0.0:8001`; puertos `8001`/`8444` publicados).
- **Riesgo:** La Admin API de Kong sin auth permite reconfigurar rutas/servicios/plugins del gateway; escuchando en 0.0.0.0 y mapeada al host queda accesible a toda máquina que alcance el puerto. Si el compose se usa fuera de un portátil aislado, es control total del gateway.
- **Recomendación:** Escuchar Admin sólo en `127.0.0.1:8001` (o red interna), no publicar 8001/8444, y proteger con auth/mTLS si debe ser remoto.

### H5. Workflows sin bloque `permissions:` (GITHUB_TOKEN con permisos por defecto)
- **Severidad:** MEDIA.
- **Comando:** `grep -riE "permissions:" .github/workflows/*.yml` → *ninguno*.
- **Riesgo:** El `GITHUB_TOKEN` opera con los permisos por defecto del repo (potencialmente read/write sobre contenidos, PRs, etc.). Un paso comprometido (acción de terceros, inyección) tendría más alcance del necesario.
- **Recomendación:** Añadir `permissions: contents: read` a nivel top y elevar por-job sólo lo imprescindible.

### H6. Modelo CodeBERT cargado con `trust_remote_code=True` y sin `revision` fijada
- **Severidad:** MEDIA.
- **Archivo:** `security/codebert-sast/codebert_sast.py:499,504-509`; modelo `mahdin70/CodeBERT-PrimeVul-BigVul` (ci-cd.yml:342).
- **Riesgo:** `trust_remote_code=True` ejecuta código Python arbitrario del repo del modelo en Hugging Face dentro del job de CI; sin `revision=<sha>` se tira siempre del `main` remoto → RCE por supply-chain si ese repo se compromete. Mitigado en parte (corre en Docker y el job `codebert-sast` no monta secretos salvo Telegram en el paso de fallo).
- **Recomendación:** Fijar `revision` a un commit concreto del modelo y, si es viable, `trust_remote_code=False` (o pre-descargar/verificar el modelo). Cachear por hash.

### H7. El SAST no escanea ficheros de configuración ni `scripts/` en CI (puntos ciegos)
- **Severidad:** MEDIA.
- **Archivo:** ci-cd.yml:386 (push: `find backend/src frontend/src frontend-vue/src services ... -name '*.ts' -o ...` → sólo extensiones de código, **sin** `.yml/.env`); ci-cd.yml:384 (PR: `grep -v '^scripts/'` excluye scripts). Motor: `codebert_sast.py` sí trae `CONFIG_RULES`/`SECRET-IN-CONFIG` y `analyze_config_file`, pero el pipeline no le pasa ficheros de config.
- **Riesgo:** La regla `SECRET-IN-CONFIG` (la que cazaría los secretos de `docker-compose.yml` del H1) **no corre contra ese archivo** en el pipeline; código en `scripts/`, en la raíz o en `k8s/*.yaml` queda sin analizar. Ironía: la debilidad que motivó extender el agente no está cableada en CI.
- **Recomendación:** Incluir `docker-compose.yml`, `k8s/**`, `.env*` y `scripts/**` en la lista de ficheros a escanear (o correr un paso `--path` sobre config), sin excluir `scripts/` en PR.

### H8. Mecanismo de supresión `// sast-ignore: RULE-ID` permite silenciar cualquier hallazgo
- **Severidad:** MEDIA.
- **Archivo:** `security/codebert-sast/codebert_sast.py:740-764`.
- **Riesgo:** Un comentario `sast-ignore: <regla>` en la línea (o en el bloque de comentarios contiguo) suprime el hallazgo, y los suprimidos **no aparecen** en el reporte. Es una función legítima anti-falsos-positivos, pero también una vía de evasión con acceso de commit; ya se usa en `env.validation.ts:13`.
- **Recomendación:** Registrar en el reporte los hallazgos suprimidos (con su justificación) en vez de omitirlos, y/o exigir que la línea `sast-ignore` incluya motivo y sea revisada en PR.

### H9. Posible inyección en `$GITHUB_ENV` vía mensaje de commit no confiable
- **Severidad:** BAJA-MEDIA.
- **Archivo:** ci-cd.yml:444-449 (y 486-493): `COMMIT_MSG=$(git log -1 --pretty=format:"%s" | head -c 300 ...)` escrito con here-doc de delimitador fijo `EOF` a `$GITHUB_ENV`.
- **Riesgo:** Un mensaje de commit que contenga una línea `EOF` cierra el here-doc antes de tiempo e inyecta variables arbitrarias en `$GITHUB_ENV` para pasos posteriores del job. Impacto acotado (sólo se usa en el `message:` de Telegram y no hay pasos ejecutables después), pero es el anti-patrón conocido de "untrusted data → GITHUB_ENV".
- **Recomendación:** Usar un delimitador aleatorio (`EOF_$RANDOM`) o escribir a fichero y leer con `jq`/`envsubst`; igual para `SAST_SUMMARY`/`VULN_DETAILS`.
- **Relacionado (BAJA):** ci-cd.yml:382-384 interpola `${{ github.base_ref }}` directamente en `run:` (`git fetch/diff`). `base_ref` es de bajo control (dev/test/main), pero conviene pasarlo por `env:` en vez de interpolar en el shell.

### H10. Dependencias vulnerables (1 ALTA en producción; 17 en total)
- **Severidad:** MEDIA.
- **Comando:** `npm audit --omit=dev` → **1 high**: `fast-uri 3.0.0-3.1.3` (GHSA-v2hh-gcrm-f6hx, host confusion). `npm audit` completo → `{low:4, moderate:8, high:5, critical:0, total:17}`.
- **Evidencia:** Las otras 4 high son de toolchain de build/dev (`@nestjs/cli`, `glob`, `picomatch`, `brace-expansion`) y el resto (Angular CLI, esbuild, webpack, tar, ajv, @hono/node-server) también dev. `fast-uri` sí aparece en el árbol de producción.
- **Recomendación:** `npm audit fix` para `fast-uri`; revisar overrides para las high de toolchain. El equipo ya documentó "11 restantes son de desarrollo" en `c0be76e`, pero el conteo creció a 17: reejecutar y actualizar.

### H11. `backend/Dockerfile` no fija usuario no-root en runtime
- **Severidad:** BAJA-MEDIA.
- **Archivo:** `backend/Dockerfile:27-48` (etapa runtime sin `USER node`).
- **Riesgo:** En Render y en docker-compose el backend corre como **root**. En k8s se mitiga con `runAsNonRoot/runAsUser:1000`, pero fuera de k8s no.
- **Recomendación:** Añadir `USER node` (o uid 1000) en la etapa runtime y ajustar permisos de `/app/keys`.

### H12. Configuración muerta: el deploy inyecta JWE/JWT secrets que el script nunca consume
- **Severidad:** BAJA.
- **Archivo:** ci-cd.yml:684-688 y deploy-render-test.yml:30-33 exportan `JWE_SECRET/JWT_SECRET/TEMP_JWT_SECRET/REFRESH_JWT_SECRET`, pero `scripts/configure-render-environment.sh` **no** hace `put_env` de ninguno (`grep put_env` → sólo `JWT_PRIVATE_KEY_PATH/PUBLIC_KEY_PATH`, `INTERNAL_API_KEY`, `SEED_ADMIN_*`). Resto de la migración a RSA (commit 921d72d).
- **Riesgo:** Confusión operativa y superficie de secretos innecesaria en el entorno del job. Indica drift entre la firma symmetric antigua y la RSA nueva.
- **Recomendación:** Quitar esas variables del workflow si de verdad ya no se usan, o consumirlas si aún hacen falta.

### H13. Claves RSA en Render se autogeneran por instancia (fragilidad, no k8s)
- **Severidad:** BAJA (disponibilidad).
- **Archivo:** `backend/Dockerfile:42-44` (`VOLUME /app/keys`, sin Secret montado en Render); `configure-render-environment.sh:55-56` sólo fija las rutas.
- **Riesgo:** En Render no hay Secret de claves montado (sí en k8s), así que `KeysService` las genera en el FS efímero → se regeneran en cada deploy/reinicio, invalidando todos los JWT/JWE emitidos. Para una sola instancia "funciona" pero es frágil y no escalaría a múltiples instancias en Render.
- **Recomendación:** Montar el par RSA desde un Secret Group / disco persistente de Render, igual que el patrón (correcto) de k8s.

### H14. Imágenes con tag flotante y Konga abandonado
- **Severidad:** BAJA.
- **Archivo:** `docker-compose.yml:85` (`pantsel/konga:latest`, proyecto sin mantenimiento, sin `KONGA_TOKEN_SECRET` → secret de sesión aleatorio por reinicio), `:247` (`sonarqube:community`).
- **Recomendación:** Fijar digests/tags concretos; considerar retirar Konga o fijar versión y `KONGA_TOKEN_SECRET`.

### H15. Drift de configuración y ramas
- **Severidad:** BAJA (informativo).
- **Evidencia:** `env.validation.ts:18-23` sólo valida 3 claves requeridas mientras `.env.example` declara ~15; `render.yaml` es de un solo servicio y `docs/despliegue/render-config.md:10` lo reconoce; la rama personal `dev-cesar` está cableada en el pipeline (`ci-cd.yml:12,31,325-337,528`) recibiendo notificación de inicio y corriendo SAST como si fuera `test` — los comentarios piden quitarla antes de integrar.
- **Recomendación:** Remover `dev-cesar` del workflow antes de la entrega; alinear `.env.example`/`env.validation`/`render.yaml`.

---

## Cumplimiento del anexo DevSecOps

| Requisito del anexo | Estado | Evidencia |
| --- | --- | --- |
| Estrategia de ramas main/test/dev | **Cumplido (con nota)** | `ci-cd.yml:3-14` dispara en dev/test/main con rigor creciente (dev = fast-path; test = +SAST; main = +Sonar+SAST+deploy). Nota: `dev-cesar` (rama personal) incluida temporalmente — H15. |
| Pipeline GitHub Actions con build + tests | **Cumplido** | Job `build-test` (ci-cd.yml:135-177): prisma validate/generate, build backend/ventas/frontend, `test` unit + `test:e2e` con `--runInBand`. |
| SonarQube/SonarCloud Quality Gate | **Cumplido (parcial)** | SonarQube **Community** self-hosted en CI (`ci-cd.yml:228-308`), gate leído (`read_gate`) y **forzado** con `exit 1` (291-304); `sonar-project.properties:14` `qualitygate.wait=true`. Limitación: Community no trae reglas de seguridad/SAST (se delega a CodeBERT) y sólo corre en push a `main`. No es SonarCloud. |
| SAST tipo CodeBERT (ML) que falle el pipeline ante vulnerabilidades | **Cumplido (con caveats)** | Agente híbrido REAL: reglas CWE deterministas (13, `codebert_sast.py:78-195`) con self-test recall/precision (`selftest.py`) + modelo CodeBERT que marca por probabilidad ≥0.85 (`codebert_sast.py:533-547`). Bloquea: `exit 1` (295) → job falla → `deploy needs codebert-sast success` (ci-cd.yml:640-657). Caveats: mitad ML evadible, config/`scripts/` no escaneados (H7), supresión disponible (H8). |
| Despliegue automático por CLI a Render/Railway | **Cumplido (Render)** | `render deploys create $RENDER_SERVICE_ID --confirm --wait --commit $GITHUB_SHA` (ci-cd.yml:693-702), CLI instalada por curl (663-670), sólo tras gates. Railway no implementado (sólo Render). |
| Gestión de secrets vía GitHub Secrets | **Cumplido (con pendiente)** | `secrets.*` en deploy/telegram/render/sonar (ci-cd.yml:37-38,674-691). `.gitignore`/`.dockerignore` correctos; k8s `secretGenerator` desde ficheros ignorados y Secrets externos en prod. Pendiente crítico: rotar los secretos del historial (H1). |
| Notificaciones a bot de Telegram | **Cumplido** | Inicio de pipeline (26-49), Quality Gate (277-289), Alerta SAST con detalle CWE/OWASP (495-519), estado de despliegue (704-715), y por rama/PR incluidos merges a main→push (`telegram-notify-main` 580-606, dev/test/PR 524-629). Acción pinneada por SHA. "Merges" se cubren vía el push resultante del merge (no hay evento merge dedicado). |

Leyenda: Cumplido / Parcial / Ausente.

---

## Aspectos correctos / valor agregado

- **Gates que SÍ bloquean el deploy** (no son decorativos): el deploy exige `build-test==success && sonarqube==success && gate_status=='OK' && codebert-selftest==success && (codebert-sast==success || no-cambios-seguridad)` (ci-cd.yml:640-651), combinando `needs:` + `exit 1` + lectura real del gate. La cadena está bien pensada.
- **Self-test del agente SAST en CI antes de confiar en él**: `codebert-selftest` corre los fixtures y exige `exit 1` sobre los vulnerables (ci-cd.yml:69-83); si el agente no detecta sus propios fixtures, su veredicto no se usa. Diseño maduro.
- **SAST híbrido y bien construido**: enriquecimiento CWE + OWASP Top 10:2025, CVEs de referencia, **redacción de secretos** en la evidencia antes de enviarla a Telegram/artefactos (`codebert_sast.py:679-701`), exención de ficheros de test, tope de matches, supresión justificada. Muy por encima del nivel académico típico.
- **k8s endurecido**: `runAsNonRoot`, `runAsUser`, `allowPrivilegeEscalation:false`, `capabilities.drop:[ALL]`, `resources` requests/limits y probes en backend/ventas/postgres/job; **NetworkPolicy default-deny + allows explícitos** (Zero Trust de red); seed en un **Job** (no en cada réplica); **HPA** en prod (2–6).
- **Manejo CORRECTO de la clave RSA** (justo el criterio del anexo): se monta desde un **Secret compartido** (`master-gateway-keys`, `backend.yaml:52-89`), NO se autogenera por pod; explícitamente justificado para HA/HPA (`hpa-backend.yaml:1-4`, `overlays/prod/kustomization.yaml:17-18`). Es el patrón bien hecho.
- **Secretos fuera de git bien gestionados de aquí en adelante**: `.gitignore` cubre `.env`, `keys/`, `*.pem`, `k8s/overlays/*/secrets.env`, `k8s/overlays/*/keys/`; `.dockerignore` excluye `.git` y `.env*`; `secret.example.yaml`/`secrets.env.example` sólo placeholders; prod con Secrets externos (Vault/Sealed/ESO documentado). Verificado: los `secrets.env`/`private.pem` en disco **nunca** fueron commiteados.
- **Supply-chain de Actions mitigada**: `appleboy/telegram-action` y `dorny/paths-filter` **pinneadas por SHA** (no por tag).
- **`pull_request` (no `pull_request_target`)**: los PRs de forks no exponen secretos ni tienen token con escritura — evita el clásico pwn-request.
- **Scripts de deploy sólidos**: `set -euo pipefail`, guards `${VAR:?}`, `jq` para construir JSON (sin inyección), `mktemp`+`trap` de limpieza; salud verificada tras el deploy (`deploy-render-test.yml:60-69`).
- **Defensa de arranque**: `env.validation.ts` rechaza secretos `change-me-*` en `production`; comentario y regla `SECRET-PLACEHOLDER` coherentes.
- **Notificaciones Telegram completas** por fase y por rama, con detalle accionable de CWE/OWASP en las alertas SAST.

## Prioridad de remediación
1. **H1** rotar secretos del historial (bloqueante para producción).
2. **H2** cerrar la ruta de deploy sin gates.
3. **H3/H4** endurecer defaults de compose y exposición de Kong Admin.
4. **H5/H6/H7** permisos de token, fijar revisión del modelo, cablear el SAST a config/scripts.
5. Resto (H8–H15) como hardening.
