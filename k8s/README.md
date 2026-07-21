# Despliegue en Kubernetes

Manifiestos Kustomize del Master Gateway. Estructura:

```
k8s/
  base/                 recursos comunes (Deployments, Services, StatefulSet, Job, Ingress, NetworkPolicy)
  overlays/dev/         1 réplica, secretos generados desde archivos locales, probe privado habilitado
  overlays/prod/        3/2/2 réplicas, HPA, probe privado deshabilitado, secretos externos
```

> El plan mencionaba `kind`; aquí se documenta con **minikube**, que hace lo mismo
> (cluster local de un nodo) y es lo que está instalado. Con `kind` los pasos son
> equivalentes cambiando `minikube image load` por `kind load docker-image`.

## Decisiones de diseño que importan

- **Claves RSA compartidas (el detalle que habilita el escalado horizontal).**
  Por defecto `KeysService` autogenera un par RSA por pod. Con varias réplicas,
  un token firmado por un pod sería rechazado por otro. Aquí el par se monta como
  volumen de sólo lectura desde el Secret `master-gateway-keys`, igual en todas
  las réplicas. Es lo que hace correcto el `HorizontalPodAutoscaler`.
- **Migración y seed en un Job, no en cada pod.** La imagen del backend por
  defecto corre `migrate deploy && seed && main.js`. Aquí el Deployment sólo
  corre `main.js`; la migración y el seed los hace una vez el Job `db-migrate`,
  para que las réplicas no compitan por sembrar.
- **Secretos fuera de git.** `base` no incluye Secrets. El overlay `dev` los
  genera con `secretGenerator` desde `secrets.env` y `keys/` (ambos ignorados por
  git). `prod` asume que los Secrets ya existen en el cluster (Vault / External
  Secrets / `kubectl create secret` desde el pipeline).
- **Postura Zero Trust:** `runAsNonRoot`, `drop: [ALL]` de capabilities,
  `allowPrivilegeEscalation: false`, y NetworkPolicies de deny-by-default con
  sólo los flujos necesarios.

## Prueba local con minikube

### 1. Arrancar el cluster e ingress

```bash
minikube start --driver=docker --cpus=2 --memory=3900
minikube addons enable ingress
```

### 2. Construir las imágenes y cargarlas en el cluster

```bash
docker build -f backend/Dockerfile        -t master-gateway-backend:dev  .
docker build -f services/ventas/Dockerfile -t master-gateway-ventas:dev  .
docker build -f frontend-vue/Dockerfile    -t master-gateway-frontend:dev frontend-vue

minikube image load master-gateway-backend:dev
minikube image load master-gateway-ventas:dev
minikube image load master-gateway-frontend:dev
```

> **Windows 11 (build 26xxx):** `minikube image load` falla con
> `exec: "wmic": executable file not found` porque `wmic` ya no viene con el
> sistema. Alternativa que carga la imagen directo en el daemon de minikube:
>
> ```bash
> docker save master-gateway-backend:dev | ( eval "$(minikube docker-env --shell bash)" && docker load )
> ```

### 3. Generar los secretos y claves del overlay dev (ignorados por git)

```bash
cd k8s/overlays/dev
cp secrets.env.example secrets.env       # y rellena JWT_SECRET, JWE_SECRET (32 bytes), etc.
mkdir -p keys
openssl genrsa -out keys/private.pem 4096
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
cd -
```

### 4. Desplegar

```bash
kubectl apply -k k8s/overlays/dev
kubectl -n master-gateway wait --for=condition=ready pod -l app=backend --timeout=180s
kubectl -n master-gateway get pods
```

### 5. Smoke test

```bash
kubectl -n master-gateway port-forward svc/backend 3000:3000 &
curl -s localhost:3000/api/health
curl -s localhost:3000/api/health/db     # comprueba conexión a Postgres
```

Para la SPA:

```bash
echo "$(minikube ip) master-gateway.local" | sudo tee -a /etc/hosts
# abrir http://master-gateway.local
```

### 6. Prueba de escalado horizontal (la clave RSA compartida)

```bash
kubectl -n master-gateway scale deploy/backend --replicas=3
kubectl -n master-gateway get pods -l app=backend
```

Haz login (obtén un `accessToken`) atacando un pod y valida ese mismo token
llamando de nuevo: al balancearse entre pods, el token sigue siendo válido porque
todos comparten el par RSA. Si cada pod generara el suyo, verías `401` intermitentes.

## Bugs reales que destapó el despliegue

Ejecutar el backend como contenedor (no sólo con `node` local) sacó a la luz dos
fallos que ni el CI ni docker-compose habían detectado:

1. **`backend/Dockerfile` no instalaba `jose`.** El `package.json` raíz declara
   los workspaces `frontend`/`frontend-vue`, pero el Dockerfile sólo copiaba los
   `package.json` de `backend` y `ventas`. Con manifiestos de workspace ausentes,
   `npm install` construía un árbol incompleto y omitía deps hoisted del backend
   como `jose` (que cifra/descifra el token JWE). El contenedor caía al arrancar
   con `Cannot find module 'jose'`. **Afectaba también al despliegue en Render:**
   el backend se habría caído en cualquier ruta autenticada. Corregido copiando
   los cuatro `package.json` de workspace.
2. **El frontend nginx no arrancaba** por el upstream `inventario:3007` sin
   resolver (`host not found in upstream`). Se añadió el Service placeholder
   `inventario` en vez de tocar el `nginx.conf` compartido con compose.

Y un detalle propio de Kubernetes: el Secret de claves RSA se monta como
`root:root`; con el pod corriendo como uid 1000 hacía falta `fsGroup: 1000` +
`defaultMode: 0440` para que el proceso pudiera leer la clave privada.

## Producción

```bash
# Los Secrets se crean fuera de git antes de aplicar:
kubectl create namespace master-gateway
kubectl -n master-gateway create secret generic master-gateway-secrets --from-env-file=produccion.env
kubectl -n master-gateway create secret generic master-gateway-keys \
  --from-file=private.pem --from-file=public.pem

kubectl apply -k k8s/overlays/prod
```

El overlay `prod` levanta 3 réplicas del backend, activa el HPA (requiere
`metrics-server`) y desactiva `ALLOW_PRIVATE_PROBE_TARGETS` para que el probe de
servicios externos no pueda alcanzar la red interna.
