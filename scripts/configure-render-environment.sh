#!/usr/bin/env bash

set -euo pipefail

required=(
  RENDER_API_KEY
  RENDER_SERVICE_ID
  INTERNAL_API_KEY
  JWE_SECRET
  JWT_SECRET
  TEMP_JWT_SECRET
  REFRESH_JWT_SECRET
  FRONTEND_ORIGIN
  OPA_URL
  SEED_ADMIN_PASSWORD
)

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "$key is required" >&2
    exit 1
  fi
done

api_url="https://api.render.com/v1"
auth_header="Authorization: Bearer $RENDER_API_KEY"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

put_env() {
  local key="$1"
  local value="$2"
  local payload="$temp_dir/env-$key.json"
  local response="$temp_dir/env-$key-response.json"
  local status

  jq -n --arg value "$value" '{value: $value}' > "$payload"
  status=$(curl --silent --show-error \
    --output "$response" \
    --write-out '%{http_code}' \
    --request PUT \
    --header "$auth_header" \
    --header "Content-Type: application/json" \
    --data-binary "@$payload" \
    "$api_url/services/$RENDER_SERVICE_ID/env-vars/$key")

  if [[ "$status" != "200" ]]; then
    echo "Unable to configure $key in Render (HTTP $status)" >&2
    jq -r '.message // .' "$response" >&2 || true
    exit 1
  fi

  echo "Configured Render environment variable: $key"
}

put_env NODE_ENV production
put_env JWT_ISSUER master-gateway
put_env JWT_AUDIENCE master-gateway-clients
put_env FRONTEND_ORIGIN "$FRONTEND_ORIGIN"
put_env JWE_SECRET "$JWE_SECRET"
put_env JWT_SECRET "$JWT_SECRET"
put_env TEMP_JWT_SECRET "$TEMP_JWT_SECRET"
put_env REFRESH_JWT_SECRET "$REFRESH_JWT_SECRET"
put_env JWT_PRIVATE_KEY_PATH ./keys/private.pem
put_env JWT_PUBLIC_KEY_PATH ./keys/public.pem
put_env INTERNAL_ALLOWED_SERVICES ventas,inventario
put_env OPA_URL "$OPA_URL"
put_env SEED_ADMIN_EMAIL "${SEED_ADMIN_EMAIL:-admin@example.com}"
put_env INTERNAL_API_KEY "$INTERNAL_API_KEY"
put_env SEED_ADMIN_PASSWORD "$SEED_ADMIN_PASSWORD"

database_env_response="$temp_dir/database-env.json"
database_env_status=$(curl --silent --show-error \
  --output "$database_env_response" \
  --write-out '%{http_code}' \
  --header "$auth_header" \
  "$api_url/services/$RENDER_SERVICE_ID/env-vars/DATABASE_URL")

if [[ "$database_env_status" == "200" ]] && \
  jq -e '.value | type == "string" and length > 0' "$database_env_response" >/dev/null; then
  echo "Render environment variable DATABASE_URL is already configured"
  exit 0
fi

if [[ "$database_env_status" != "200" && "$database_env_status" != "404" ]]; then
  echo "Unable to inspect DATABASE_URL in Render (HTTP $database_env_status)" >&2
  exit 1
fi

service_response="$temp_dir/service.json"
curl --fail --silent --show-error \
  --header "$auth_header" \
  "$api_url/services/$RENDER_SERVICE_ID" > "$service_response"

owner_id=$(jq -r '.ownerId' "$service_response")
region=$(jq -r '.serviceDetails.region' "$service_response")
database_name="master-gateway-db"
database_id="${RENDER_DATABASE_ID:-}"

if [[ -z "$database_id" ]]; then
  databases_response="$temp_dir/databases.json"
  curl --fail --silent --show-error --get \
    --header "$auth_header" \
    --data-urlencode "ownerId=$owner_id" \
    --data-urlencode "limit=100" \
    "$api_url/postgres" > "$databases_response"

  database_id=$(jq -r \
    --arg name "$database_name" \
    --arg region "$region" \
    'map(.postgres | select(.name == $name and .region == $region and .role == "primary")) | .[0].id // empty' \
    "$databases_response")

  if [[ -z "$database_id" ]]; then
    same_region_count=$(jq \
      --arg region "$region" \
      '[.[] | .postgres | select(.region == $region and .role == "primary" and .suspended == "not_suspended")] | length' \
      "$databases_response")

    if [[ "$same_region_count" == "1" ]]; then
      database_id=$(jq -r \
        --arg region "$region" \
        '[.[] | .postgres | select(.region == $region and .role == "primary" and .suspended == "not_suspended")] | .[0].id' \
        "$databases_response")
      existing_name=$(jq -r \
        --arg id "$database_id" \
        '.[] | .postgres | select(.id == $id) | .name' \
        "$databases_response")
      echo "Using the only existing PostgreSQL instance in $region: $existing_name"
    elif [[ "$same_region_count" -gt "1" ]]; then
      echo "Multiple PostgreSQL instances exist in $region; configure RENDER_DATABASE_ID" >&2
      exit 1
    fi
  fi
fi

if [[ -z "$database_id" ]]; then
  create_payload="$temp_dir/create-database.json"
  create_response="$temp_dir/create-database-response.json"
  jq -n \
    --arg name "$database_name" \
    --arg ownerId "$owner_id" \
    --arg region "$region" \
    '{
      name: $name,
      databaseName: "master_gateway",
      databaseUser: "master_gateway",
      ownerId: $ownerId,
      plan: "free",
      region: $region,
      version: "16"
    }' > "$create_payload"

  create_status=$(curl --silent --show-error \
    --output "$create_response" \
    --write-out '%{http_code}' \
    --request POST \
    --header "$auth_header" \
    --header "Content-Type: application/json" \
    --data-binary "@$create_payload" \
    "$api_url/postgres")

  if [[ "$create_status" != "201" ]]; then
    echo "Unable to create free Render PostgreSQL (HTTP $create_status)" >&2
    jq -r '.message // .' "$create_response" >&2 || true
    exit 1
  fi

  database_id=$(jq -r '.id' "$create_response")
  echo "Created free Render PostgreSQL: $database_name"
fi

database_response="$temp_dir/database.json"
database_status="unknown"
for attempt in $(seq 1 90); do
  curl --fail --silent --show-error \
    --header "$auth_header" \
    "$api_url/postgres/$database_id" > "$database_response"
  database_status=$(jq -r '.status' "$database_response")
  echo "PostgreSQL status: $database_status (attempt $attempt/90)"

  if [[ "$database_status" == "available" ]]; then
    break
  fi
  if [[ "$database_status" == "unavailable" || "$database_status" == "recovery_failed" || "$database_status" == "suspended" ]]; then
    exit 1
  fi
  sleep 10
done

if [[ "$database_status" != "available" ]]; then
  echo "PostgreSQL did not become available in time" >&2
  exit 1
fi

connection_response="$temp_dir/connection.json"
curl --fail --silent --show-error \
  --header "$auth_header" \
  "$api_url/postgres/$database_id/connection-info" > "$connection_response"

database_url=$(jq -r '.internalConnectionString // empty' "$connection_response")
if [[ -z "$database_url" ]]; then
  echo "Render did not return an internal PostgreSQL connection string" >&2
  exit 1
fi

put_env DATABASE_URL "$database_url"
echo "Render PostgreSQL is linked to the backend service"
