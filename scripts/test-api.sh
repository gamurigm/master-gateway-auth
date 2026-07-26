#!/usr/bin/env bash
set -euo pipefail

: "${API_URL:?Define API_URL, por ejemplo https://master-gateway-auth.onrender.com/api}"
VENTAS_URL="${VENTAS_URL:-}"
EMAIL="${EMAIL:-admin@example.com}"
PASSWORD="${PASSWORD:?Define PASSWORD, ej: Admin12345!}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-}"
INTERNAL_SERVICE="${INTERNAL_SERVICE:-ventas}"
command -v node >/dev/null 2>&1 || { echo "ERROR: instala Node.js para interpretar JSON." >&2; exit 1; }

say() { printf '\n\033[1;36m%s\033[0m\n' "$1"; }
json_body() {
  node -e '
    const [kind, ...args] = process.argv.slice(1);
    const bodies = {
      login: () => ({ email: args[0], password: args[1] }),
      selectRole: () => ({ tempToken: args[0], roleId: args[1] }),
      createUser: () => ({ email: args[0], password: process.env['TEST_USER_PASSWORD'] || 'ChangeMe123!', firstName: "Usuario", lastName: "POST" }),
      createRole: () => ({ name: args[0], description: "Rol creado por prueba remota", permissionIds: [args[1]] }),
      createModule: () => ({ code: args[0], name: "Modulo POST", description: "Modulo creado por prueba remota" }),
      createMenu: () => ({ name: "Menu POST", url: "/post-demo", icon: "flask", order: 99, moduleId: args[0] }),
      assignUser: () => ({ userId: args[0] }),
      assignModule: () => ({ moduleId: args[0] }),
      assignMenu: () => ({ menuId: args[0] }),
      validateToken: () => ({ token: args[0] }),
      logout: () => ({ refreshToken: args[0] }),
    };
    console.log(JSON.stringify(bodies[kind]()));
  ' "$@"
}
json_pick() {
  JSON_INPUT="$LAST_RESPONSE" node -e '
    const data = JSON.parse(process.env.JSON_INPUT || "null");
    const path = process.argv[1].split(".");
    const value = path.reduce((acc, key) => {
      if (acc == null) return undefined;
      return /^\d+$/.test(key) ? acc[Number(key)] : acc[key];
    }, data);
    if (value != null) console.log(value);
  ' "$1"
}
json_id() {
  JSON_INPUT="$LAST_RESPONSE" node -e '
    const data = JSON.parse(process.env.JSON_INPUT || "null");
    console.log(data?.id ?? data?.data?.id ?? "");
  '
}
json_permission_id() {
  JSON_INPUT="$LAST_RESPONSE" node -e '
    const data = JSON.parse(process.env.JSON_INPUT || "[]");
    console.log((Array.isArray(data) ? data : []).find((item) => item.code === process.argv[1])?.id ?? "");
  ' "$1"
}
json_summary() {
  JSON_INPUT="$LAST_RESPONSE" node -e '
    const data = JSON.parse(process.env.JSON_INPUT || "{}");
    const out = {};
    for (const key of process.argv.slice(1)) out[key] = data[key];
    console.log(JSON.stringify(out, null, 2));
  ' "$@"
}
json_error() {
  JSON_INPUT="$LAST_RESPONSE" node -e '
    try {
      const data = JSON.parse(process.env.JSON_INPUT || "{}");
      const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      console.error(message ?? data.error ?? JSON.stringify(data));
    } catch {
      console.error(process.env.JSON_INPUT || "Error sin cuerpo");
    }
  '
}
request() {
  local label="$1" method="$2" url="$3" body=""
  shift 3
  if [[ $# -gt 0 && "$1" != "-H" && "$1" != "--header" ]]; then
    body="$1"
    shift
  fi
  local tmp status; tmp="$(mktemp)"
  if [[ -n "$body" ]]; then
    status="$(curl --silent --show-error --output "$tmp" --write-out '%{http_code}' --request "$method" "$url" -H 'Content-Type: application/json' "$@" --data "$body")"
  else
    status="$(curl --silent --show-error --output "$tmp" --write-out '%{http_code}' --request "$method" "$url" "$@")"
  fi
  LAST_RESPONSE="$(cat "$tmp")"; rm -f "$tmp"
  if [[ "$status" =~ ^2 ]]; then printf 'OK %-34s HTTP %s\n' "$label" "$status"; else printf 'FALLO %-30s HTTP %s\n' "$label" "$status" >&2; json_error; exit 1; fi
}

say '1. Salud del API'
request 'Health' GET "$API_URL/health"; json_summary status service timestamp
request 'Health de base de datos' GET "$API_URL/health/db"; json_summary status database timestamp

say '2. Login y selección de rol'
request 'Login' POST "$API_URL/auth/login" "$(json_body login "$EMAIL" "$PASSWORD")"
TEMP_TOKEN="$(json_pick tempToken)"; ROLE_ID="$(json_pick roles.0.id)"
request 'Seleccionar rol' POST "$API_URL/auth/select-role" "$(json_body selectRole "$TEMP_TOKEN" "$ROLE_ID")"
ACCESS_TOKEN="$(json_pick accessToken)"; REFRESH_TOKEN="$(json_pick refreshToken)"; AUTH="Authorization: Bearer $ACCESS_TOKEN"

say '3. Consultas protegidas'
request 'Árbol de menús' GET "$API_URL/menus/tree" -H "$AUTH"
request 'Usuarios' GET "$API_URL/users?page=1&limit=20" -H "$AUTH"
request 'Roles' GET "$API_URL/roles?page=1&limit=20" -H "$AUTH"
request 'Permisos' GET "$API_URL/permissions" -H "$AUTH"
USERS_READ_PERMISSION_ID="$(json_permission_id users:read)"
if [[ -z "$USERS_READ_PERMISSION_ID" ]]; then
  echo "ERROR: no se encontro el permiso users:read en el catalogo." >&2
  exit 1
fi
request 'Módulos' GET "$API_URL/modules?page=1&limit=20" -H "$AUTH"

say '4. Todos los POST de datos'
RUN_ID="$(date +%s)"
RUN_SUFFIX="$(printf '%s' "$(date +%s%N)" | sha256sum | tr '0-9a-f' 'A-P' | cut -c1-6)"
ROLE_NAME="POST_DEMO_$RUN_SUFFIX"
MODULE_CODE="POST_DEMO_$RUN_SUFFIX"
request 'Crear usuario' POST "$API_URL/users" "$(json_body createUser "post-$RUN_ID@example.com")" -H "$AUTH"; CREATED_USER_ID="$(json_id)"
request 'Crear rol' POST "$API_URL/roles" "$(json_body createRole "$ROLE_NAME" "$USERS_READ_PERMISSION_ID")" -H "$AUTH"; CREATED_ROLE_ID="$(json_id)"
request 'Crear módulo' POST "$API_URL/modules" "$(json_body createModule "$MODULE_CODE")" -H "$AUTH"; CREATED_MODULE_ID="$(json_id)"
request 'Crear menú' POST "$API_URL/menus" "$(json_body createMenu "$CREATED_MODULE_ID")" -H "$AUTH"; CREATED_MENU_ID="$(json_id)"
if [[ -n "$CREATED_ROLE_ID" ]]; then
  request 'Asignar usuario' POST "$API_URL/roles/$CREATED_ROLE_ID/users" "$(json_body assignUser "$CREATED_USER_ID")" -H "$AUTH"
  request 'Asignar módulo' POST "$API_URL/roles/$CREATED_ROLE_ID/modules" "$(json_body assignModule "$CREATED_MODULE_ID")" -H "$AUTH"
  request 'Asignar menú' POST "$API_URL/roles/$CREATED_ROLE_ID/menus" "$(json_body assignMenu "$CREATED_MENU_ID")" -H "$AUTH"
fi

if [[ -n "$INTERNAL_API_KEY" ]]; then
  say '5. Validación interna'
  request 'Validar token interno' POST "$API_URL/internals/validate-token" "$(json_body validateToken "$ACCESS_TOKEN")" -H "x-internal-api-key: $INTERNAL_API_KEY" -H "x-internal-service: $INTERNAL_SERVICE"
fi
if [[ -n "$VENTAS_URL" ]]; then
  say '6. Servicio remoto de ventas'
  request 'Health de ventas' GET "$VENTAS_URL/health"; request 'Pedidos' GET "$VENTAS_URL/ventas/ordenes" -H "$AUTH"
fi

say '7. Logout'
request 'Cerrar sesión' POST "$API_URL/auth/logout" "$(json_body logout "$REFRESH_TOKEN")" -H "$AUTH"
printf '\nPruebas API finalizadas: todos los pasos respondieron correctamente.\n'
