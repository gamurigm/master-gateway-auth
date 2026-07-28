#!/usr/bin/env bash

set -euo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"
: "${RENDER_BACKEND_SERVICE_ID:?RENDER_BACKEND_SERVICE_ID is required}"

api_url="https://api.render.com/v1"
auth_header="Authorization: Bearer $RENDER_API_KEY"
frontend_name="master-gateway-frontend"
frontend_branch="${RENDER_FRONTEND_BRANCH:-main}"
frontend_id="${RENDER_FRONTEND_SERVICE_ID:-}"
# El frontend es Vue + Vite (`frontend-vue`), no el Angular legado. La ruta de
# publicacion anterior (`frontend/dist/frontend/browser`) era la salida de
# Angular y ya no existe. Vite lee `VITE_API_URL` del entorno en tiempo de
# build, asi que tampoco hace falta generar un fichero de entorno previo.
build_command="npm ci --include=dev && npm run build:frontend"
publish_path="frontend-vue/dist"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

backend_response="$temp_dir/backend.json"
curl --fail --silent --show-error \
  --header "$auth_header" \
  "$api_url/services/$RENDER_BACKEND_SERVICE_ID" > "$backend_response"

owner_id=$(jq -r '.ownerId' "$backend_response")
repo=$(jq -r '.repo' "$backend_response")
backend_url=$(jq -r '.serviceDetails.url' "$backend_response")

if [[ -n "$frontend_id" ]]; then
  frontend_response="$temp_dir/frontend.json"
  curl --fail --silent --show-error \
    --header "$auth_header" \
    "$api_url/services/$frontend_id" > "$frontend_response"

  frontend_type=$(jq -r '.type // empty' "$frontend_response")
  frontend_owner_id=$(jq -r '.ownerId // empty' "$frontend_response")
  if [[ "$frontend_type" != "static_site" ]]; then
    echo "RENDER_FRONTEND_SERVICE_ID no corresponde a un static_site" >&2
    exit 1
  fi
  if [[ "$frontend_owner_id" != "$owner_id" ]]; then
    echo "Backend y frontend pertenecen a workspaces distintos" >&2
    exit 1
  fi
else
  services_response="$temp_dir/services.json"
  curl --fail --silent --show-error --get \
    --header "$auth_header" \
    --data-urlencode "ownerId=$owner_id" \
    --data-urlencode "name=$frontend_name" \
    --data-urlencode "limit=100" \
    "$api_url/services" > "$services_response"

  frontend_id=$(jq -r \
    --arg name "$frontend_name" \
    'map(.service | select(.name == $name and .type == "static_site")) | .[0].id // empty' \
    "$services_response")
fi

if [[ -z "$frontend_id" ]]; then
  create_payload="$temp_dir/create-frontend.json"
  create_response="$temp_dir/create-frontend-response.json"
  jq -n \
    --arg name "$frontend_name" \
    --arg ownerId "$owner_id" \
    --arg repo "$repo" \
    --arg branch "$frontend_branch" \
    --arg buildCommand "$build_command" \
    --arg publishPath "$publish_path" \
    --arg apiUrl "$backend_url/api" \
    '{
      type: "static_site",
      name: $name,
      ownerId: $ownerId,
      repo: $repo,
      branch: $branch,
      autoDeploy: "no",
      rootDir: "",
      envVars: [{key: "VITE_API_URL", value: $apiUrl}],
      serviceDetails: {
        buildCommand: $buildCommand,
        publishPath: $publishPath,
        previews: {generation: "off"},
        routes: [{type: "rewrite", source: "/*", destination: "/index.html"}]
      }
    }' > "$create_payload"

  create_status=$(curl --silent --show-error \
    --output "$create_response" \
    --write-out '%{http_code}' \
    --request POST \
    --header "$auth_header" \
    --header "Content-Type: application/json" \
    --data-binary "@$create_payload" \
    "$api_url/services")

  if [[ "$create_status" != "201" ]]; then
    echo "Unable to create Render frontend service (HTTP $create_status)" >&2
    jq -r '.message // .' "$create_response" >&2 || true
    exit 1
  fi

  frontend_id=$(jq -r '.service.id' "$create_response")
  frontend_url=$(jq -r '.service.serviceDetails.url' "$create_response")
  echo "Created Render static site: $frontend_name"
else
  update_payload="$temp_dir/update-frontend.json"
  update_response="$temp_dir/update-frontend-response.json"
  jq -n \
    --arg branch "$frontend_branch" \
    --arg buildCommand "$build_command" \
    --arg publishPath "$publish_path" \
    '{
      autoDeploy: "no",
      branch: $branch,
      rootDir: "",
      serviceDetails: {
        buildCommand: $buildCommand,
        publishPath: $publishPath
      }
    }' > "$update_payload"

  update_status=$(curl --silent --show-error \
    --output "$update_response" \
    --write-out '%{http_code}' \
    --request PATCH \
    --header "$auth_header" \
    --header "Content-Type: application/json" \
    --data-binary "@$update_payload" \
    "$api_url/services/$frontend_id")

  if [[ "$update_status" != "200" ]]; then
    echo "Unable to update Render frontend service (HTTP $update_status)" >&2
    jq -r '.message // .' "$update_response" >&2 || true
    exit 1
  fi

  frontend_url=$(jq -r '.serviceDetails.url' "$update_response")
  echo "Updated Render static site: $frontend_name"
fi

frontend_env_payload="$temp_dir/frontend-env.json"
jq -n --arg value "$backend_url/api" '{value: $value}' > "$frontend_env_payload"
curl --fail --silent --show-error \
  --request PUT \
  --header "$auth_header" \
  --header "Content-Type: application/json" \
  --data-binary "@$frontend_env_payload" \
  "$api_url/services/$frontend_id/env-vars/VITE_API_URL" >/dev/null

routes_payload="$temp_dir/routes.json"
jq -n '[{type: "rewrite", source: "/*", destination: "/index.html"}]' > "$routes_payload"
curl --fail --silent --show-error \
  --request PUT \
  --header "$auth_header" \
  --header "Content-Type: application/json" \
  --data-binary "@$routes_payload" \
  "$api_url/services/$frontend_id/routes" >/dev/null

backend_origin_response="$temp_dir/backend-origin.json"
backend_origin_status=$(curl --silent --show-error \
  --output "$backend_origin_response" \
  --write-out '%{http_code}' \
  --header "$auth_header" \
  "$api_url/services/$RENDER_BACKEND_SERVICE_ID/env-vars/FRONTEND_ORIGIN")

backend_redeploy_required=true
if [[ "$backend_origin_status" == "200" ]] && \
  [[ "$(jq -r '.value // empty' "$backend_origin_response")" == "$frontend_url" ]]; then
  backend_redeploy_required=false
fi

backend_env_payload="$temp_dir/backend-env.json"
jq -n --arg value "$frontend_url" '{value: $value}' > "$backend_env_payload"
curl --fail --silent --show-error \
  --request PUT \
  --header "$auth_header" \
  --header "Content-Type: application/json" \
  --data-binary "@$backend_env_payload" \
  "$api_url/services/$RENDER_BACKEND_SERVICE_ID/env-vars/FRONTEND_ORIGIN" >/dev/null

echo "Frontend URL: $frontend_url"
echo "Frontend API URL: $backend_url/api"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "frontend_id=$frontend_id"
    echo "frontend_url=$frontend_url"
    echo "backend_redeploy_required=$backend_redeploy_required"
  } >> "$GITHUB_OUTPUT"
fi
