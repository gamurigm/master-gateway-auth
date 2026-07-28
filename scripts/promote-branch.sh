#!/usr/bin/env bash
set -euo pipefail

source_branch="${1:?source branch is required}"
target_branch="${2:?target branch is required}"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

case "${source_branch}:${target_branch}" in
  dev:test|test:main) ;;
  *)
    echo "::error::Promocion no permitida: ${source_branch} -> ${target_branch}"
    exit 1
    ;;
esac

if [ -z "${GH_TOKEN:-}" ]; then
  echo "::error::Configura BRANCH_PROMOTION_TOKEN en GitHub Actions secrets."
  exit 1
fi

ahead_by="$(
  gh api \
    "repos/${repository}/compare/${target_branch}...${source_branch}" \
    --jq '.ahead_by'
)"

if [ "$ahead_by" = "0" ]; then
  echo "Promocion ${source_branch} -> ${target_branch} omitida: las ramas ya estan sincronizadas."
  exit 0
fi

pr_number="$(
  gh pr list \
    --repo "$repository" \
    --head "$source_branch" \
    --base "$target_branch" \
    --state open \
    --json number \
    --jq '.[0].number // empty'
)"

if [ -z "$pr_number" ]; then
  gh pr create \
    --repo "$repository" \
    --head "$source_branch" \
    --base "$target_branch" \
    --title "chore: promote ${source_branch} to ${target_branch}" \
    --body "Promocion automatica creada despues de superar el pipeline de ${source_branch}."

  pr_number="$(
    gh pr list \
      --repo "$repository" \
      --head "$source_branch" \
      --base "$target_branch" \
      --state open \
      --json number \
      --jq '.[0].number // empty'
  )"
fi

if [ -z "$pr_number" ]; then
  echo "::error::No se pudo crear o localizar el Pull Request de promocion."
  exit 1
fi

gh pr merge "$pr_number" \
  --repo "$repository" \
  --auto \
  --merge

echo "Promocion ${source_branch} -> ${target_branch} preparada en PR #${pr_number}."
