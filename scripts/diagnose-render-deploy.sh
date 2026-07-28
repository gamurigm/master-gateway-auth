#!/usr/bin/env bash

set -uo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"

service_id="${1:?Render service ID is required}"
api_url="https://api.render.com/v1"
auth_header="Authorization: Bearer $RENDER_API_KEY"
service_json="$(mktemp)"
deploys_json="$(mktemp)"
trap 'rm -f "$service_json" "$deploys_json"' EXIT

echo "::group::Render deploy details ($service_id)"
if curl --fail --silent --show-error \
  --header "$auth_header" \
  "$api_url/services/$service_id" > "$service_json"; then
  workspace_id="$(jq -r '.ownerId // empty' "$service_json")"
else
  workspace_id=""
fi

if curl --fail --silent --show-error \
  --get \
  --header "$auth_header" \
  --data-urlencode "limit=1" \
  "$api_url/services/$service_id/deploys" > "$deploys_json"; then
  jq '.[0].deploy | {id, status, errorMessage, createdAt, finishedAt, commit}' \
    "$deploys_json"
fi
echo "::endgroup::"

echo "::group::Render recent service logs ($service_id)"
if [[ -n "$workspace_id" ]]; then
  render workspace set "$workspace_id" || true
  render logs \
    --resources "$service_id" \
    --start "$(date -u -d '20 minutes ago' +'%Y-%m-%dT%H:%M:%SZ')" \
    --direction backward \
    --limit 200 \
    --output json || true
else
  echo "No se pudo determinar el workspace del servicio."
fi
echo "::endgroup::"
