#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WRANGLER_BIN="${WRANGLER:-./node_modules/.bin/wrangler}"
PAGES_BRANCH="${PAGES_BRANCH:-}"
PAGES_COMMIT_HASH="${PAGES_COMMIT_HASH:-}"
PAGES_VERIFY_ATTEMPTS="${PAGES_VERIFY_ATTEMPTS:-30}"
PAGES_VERIFY_SLEEP_SECONDS="${PAGES_VERIFY_SLEEP_SECONDS:-10}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for Pages deployment verification." >&2
  exit 1
fi

if [[ "$WRANGLER_BIN" == */* ]]; then
  if [[ ! -x "$WRANGLER_BIN" ]]; then
    echo "Wrangler binary not found/executable: $WRANGLER_BIN" >&2
    exit 1
  fi
else
  if ! command -v "$WRANGLER_BIN" >/dev/null 2>&1; then
    echo "Wrangler command not found in PATH: $WRANGLER_BIN" >&2
    exit 1
  fi
fi

if [[ -z "$PAGES_BRANCH" ]]; then
  echo "PAGES_BRANCH is required for Pages deployment verification." >&2
  exit 1
fi

if [[ -z "$PAGES_COMMIT_HASH" ]]; then
  echo "PAGES_COMMIT_HASH is required for Pages deployment verification." >&2
  exit 1
fi

for required_project in PAGES_PROJECT_SITE PAGES_PROJECT_DOCS PAGES_PROJECT_WEB PAGES_PROJECT_DEMO; do
  if [[ -z "${!required_project:-}" ]]; then
    echo "${required_project} is required for Pages deployment verification." >&2
    exit 1
  fi
done

if [[ "$PAGES_BRANCH" == "stable" ]]; then
  PAGES_ENVIRONMENT="production"
else
  PAGES_ENVIRONMENT="preview"
fi

verify_project() {
  local project_name="$1"
  local attempt stage alias_line

  for ((attempt = 1; attempt <= PAGES_VERIFY_ATTEMPTS; attempt++)); do
    local deployments_json
    deployments_json="$("$WRANGLER_BIN" pages deployment list \
      --project-name "$project_name" \
      --environment "$PAGES_ENVIRONMENT" \
      --json)"

    stage="$(echo "$deployments_json" | jq -r \
      --arg branch "$PAGES_BRANCH" \
      --arg commit_hash "$PAGES_COMMIT_HASH" \
      '
      [ .[]
        | select(.deployment_trigger.metadata.branch == $branch)
        | select(.deployment_trigger.metadata.commit_hash == $commit_hash)
      ] as $matches
      | if ($matches | length) == 0
        then "missing"
        else ($matches[0].latest_stage.status // "unknown")
        end
      ')"

    alias_line="$(echo "$deployments_json" | jq -r \
      --arg branch "$PAGES_BRANCH" \
      --arg commit_hash "$PAGES_COMMIT_HASH" \
      '
      [ .[]
        | select(.deployment_trigger.metadata.branch == $branch)
        | select(.deployment_trigger.metadata.commit_hash == $commit_hash)
      ] as $matches
      | if ($matches | length) == 0
        then ""
        else ($matches[0].aliases | join(", "))
        end
      ')"

    if [[ "$stage" == "success" ]]; then
      echo "[verify-pages] ${project_name}: success (branch=${PAGES_BRANCH}, commit=${PAGES_COMMIT_HASH})"
      if [[ -n "$alias_line" ]]; then
        echo "[verify-pages] ${project_name}: aliases=${alias_line}"
      fi
      return 0
    fi

    if [[ "$stage" == "failure" || "$stage" == "canceled" ]]; then
      echo "[verify-pages] ${project_name}: deployment stage=${stage} for branch=${PAGES_BRANCH}, commit=${PAGES_COMMIT_HASH}" >&2
      return 1
    fi

    echo "[verify-pages] ${project_name}: waiting (stage=${stage}, attempt=${attempt}/${PAGES_VERIFY_ATTEMPTS})"
    if (( attempt < PAGES_VERIFY_ATTEMPTS )); then
      sleep "$PAGES_VERIFY_SLEEP_SECONDS"
    fi
  done

  echo "[verify-pages] ${project_name}: did not reach success for branch=${PAGES_BRANCH}, commit=${PAGES_COMMIT_HASH}" >&2
  return 1
}

verify_project "$PAGES_PROJECT_SITE"
verify_project "$PAGES_PROJECT_DOCS"
verify_project "$PAGES_PROJECT_WEB"
verify_project "$PAGES_PROJECT_DEMO"

echo "[verify-pages] all Pages targets verified for branch=${PAGES_BRANCH}, commit=${PAGES_COMMIT_HASH}"
