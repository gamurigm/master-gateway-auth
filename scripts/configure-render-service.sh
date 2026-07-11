#!/usr/bin/env bash

set -euo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"
: "${RENDER_SERVICE_ID:?RENDER_SERVICE_ID is required}"

payload="$(mktemp)"
response="$(mktemp)"
trap 'rm -f "$payload" "$response"' EXIT

jq -n \
  --arg buildCommand "npm ci --include=dev && npm run build:backend" \
  --arg startCommand "npm run start:backend:prod" \
  --arg healthCheckPath "/api/health" \
  '{
    autoDeploy: "no",
    rootDir: "",
    serviceDetails: {
      healthCheckPath: $healthCheckPath,
      envSpecificDetails: {
        buildCommand: $buildCommand,
        startCommand: $startCommand
      }
    }
  }' > "$payload"

status=$(curl --silent --show-error \
  --output "$response" \
  --write-out '%{http_code}' \
  --request PATCH \
  --header "Authorization: Bearer $RENDER_API_KEY" \
  --header "Content-Type: application/json" \
  --data-binary "@$payload" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID")

if [[ "$status" != "200" ]]; then
  echo "Render service update failed with HTTP $status" >&2
  jq -r '.message // .' "$response" >&2 || cat "$response" >&2
  exit 1
fi

service_url=$(jq -r '.serviceDetails.url // empty' "$response")
jq '{
  id,
  name,
  autoDeploy,
  rootDir,
  buildCommand: .serviceDetails.envSpecificDetails.buildCommand,
  startCommand: .serviceDetails.envSpecificDetails.startCommand,
  healthCheckPath: .serviceDetails.healthCheckPath,
  url: .serviceDetails.url
}' "$response"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "service_url=$service_url" >> "$GITHUB_OUTPUT"
fi
