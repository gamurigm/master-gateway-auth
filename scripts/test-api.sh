#!/usr/bin/env bash
set -euo pipefail

: "${API_URL:?Define API_URL, por ejemplo https://master-gateway-auth.onrender.com/api}"
VENTAS_URL="${VENTAS_URL:-}"
EMAIL="${EMAIL:-admin@example.com}"
PASSWORD="${PASSWORD:-Admin12345!}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-}"
INTERNAL_SERVICE="${INTERNAL_SERVICE:-ventas}"
command -v jq >/dev/null 2>&1 || { echo "ERROR: instala jq para interpretar JSON." >&2; exit 1; }

say() { printf '\n\033[1;36m%s\033[0m\n' "$1"; }
request() {
  local label="$1" method="$2" url="$3" body="${4:-}"; shift 4 || true
  local tmp status; tmp="$(mktemp)"
  if [[ -n "$body" ]]; then
    status="$(curl --silent --show-error --output "$tmp" --write-out '%{http_code}' --request "$method" "$url" -H 'Content-Type: application/json' "$@" --data "$body")"
  else
    status="$(curl --silent --show-error --output "$tmp" --write-out '%{http_code}' --request "$method" "$url" "$@")"
  fi
  LAST_RESPONSE="$(cat "$tmp")"; rm -f "$tmp"
  if [[ "$status" =~ ^2 ]]; then printf 'OK %-34s HTTP %s\n' "$label" "$status"; else printf 'FALLO %-30s HTTP %s\n' "$label" "$status" >&2; echo "$LAST_RESPONSE" | jq -r '.message // .error // .' >&2 || true; exit 1; fi
}

say '1. Salud remota en Render'
request 'Health' GET "$API_URL/health"; echo "$LAST_RESPONSE" | jq '{status,service,timestamp}'
request 'Health de base de datos' GET "$API_URL/health/db"; echo "$LAST_RESPONSE" | jq '{status,database,timestamp}'

say '2. Login y selección de rol'
request 'Login' POST "$API_URL/auth/login" "$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')"
TEMP_TOKEN="$(echo "$LAST_RESPONSE" | jq -r '.tempToken')"; ROLE_ID="$(echo "$LAST_RESPONSE" | jq -r '.roles[0].id')"
request 'Seleccionar rol' POST "$API_URL/auth/select-role" "$(jq -n --arg t "$TEMP_TOKEN" --arg r "$ROLE_ID" '{tempToken:$t,roleId:$r}')"
ACCESS_TOKEN="$(echo "$LAST_RESPONSE" | jq -r '.accessToken')"; REFRESH_TOKEN="$(echo "$LAST_RESPONSE" | jq -r '.refreshToken')"; AUTH="Authorization: Bearer $ACCESS_TOKEN"

say '3. Consultas protegidas'
request 'Árbol de menús' GET "$API_URL/menus/tree" -H "$AUTH"
request 'Usuarios' GET "$API_URL/users?page=1&limit=20" -H "$AUTH"
request 'Roles' GET "$API_URL/roles?page=1&limit=20" -H "$AUTH"
request 'Módulos' GET "$API_URL/modules?page=1&limit=20" -H "$AUTH"

say '4. Todos los POST de datos'
RUN_ID="$(date +%s)"
request 'Crear usuario' POST "$API_URL/users" "$(jq -n --arg e "post-$RUN_ID@example.com" '{email:$e,password:"PostDemo123!",firstName:"Usuario",lastName:"POST"}')" -H "$AUTH"; CREATED_USER_ID="$(echo "$LAST_RESPONSE" | jq -r '.id // .data.id')"
request 'Crear rol' POST "$API_URL/roles" '{name:"POST_DEMO",description:"Rol creado por prueba remota"}' -H "$AUTH" || true; CREATED_ROLE_ID="$(echo "$LAST_RESPONSE" | jq -r '.id // .data.id // empty')"
request 'Crear módulo' POST "$API_URL/modules" '{code:"POST_DEMO",name:"Módulo POST",description:"Módulo creado por prueba remota"}' -H "$AUTH"; CREATED_MODULE_ID="$(echo "$LAST_RESPONSE" | jq -r '.id // .data.id')"
request 'Crear menú' POST "$API_URL/menus" "$(jq -n --arg m "$CREATED_MODULE_ID" '{name:"Menú POST",url:"/post-demo",icon:"flask",order:99,moduleId:$m}')" -H "$AUTH"; CREATED_MENU_ID="$(echo "$LAST_RESPONSE" | jq -r '.id // .data.id')"
if [[ -n "$CREATED_ROLE_ID" ]]; then
  request 'Asignar usuario' POST "$API_URL/roles/$CREATED_ROLE_ID/users" "$(jq -n --arg u "$CREATED_USER_ID" '{userId:$u}')" -H "$AUTH"
  request 'Asignar módulo' POST "$API_URL/roles/$CREATED_ROLE_ID/modules" "$(jq -n --arg m "$CREATED_MODULE_ID" '{moduleId:$m}')" -H "$AUTH"
  request 'Asignar menú' POST "$API_URL/roles/$CREATED_ROLE_ID/menus" "$(jq -n --arg m "$CREATED_MENU_ID" '{menuId:$m}')" -H "$AUTH"
fi

if [[ -n "$INTERNAL_API_KEY" ]]; then
  say '5. Validación interna'
  request 'Validar token interno' POST "$API_URL/internals/validate-token" "$(jq -n --arg t "$ACCESS_TOKEN" '{token:$t}')" -H "x-internal-api-key: $INTERNAL_API_KEY" -H "x-internal-service: $INTERNAL_SERVICE"
fi
if [[ -n "$VENTAS_URL" ]]; then
  say '6. Servicio remoto de ventas'
  request 'Health de ventas' GET "$VENTAS_URL/health"; request 'Pedidos' GET "$VENTAS_URL/ventas/ordenes" -H "$AUTH"
fi

say '7. Logout'
request 'Cerrar sesión' POST "$API_URL/auth/logout" "$(jq -n --arg r "$REFRESH_TOKEN" '{refreshToken:$r}')" -H "$AUTH"
printf '\nPruebas remotas finalizadas: todos los pasos respondieron correctamente.\n'