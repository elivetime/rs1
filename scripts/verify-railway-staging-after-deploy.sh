#!/usr/bin/env bash
# Post-deploy HTTP probe for Railway (used by railway-deploy.yml).
set -euo pipefail

PROBE_URL="${DEPLOY_BASE_URL:-${STAGING_URL:-}}"
if [ -z "${PROBE_URL}" ]; then
  # shellcheck disable=SC1091
  source "$(dirname "$0")/railway-staging-url.env"
  PROBE_URL="${STAGING_URL}"
fi

if [[ "${PROBE_URL}" == *"REPLACE_AFTER_FIRST_DEPLOY"* ]]; then
  echo "::warning::STAGING_URL is still a placeholder — update scripts/railway-staging-url.env after the first deploy, then re-run smokes."
  exit 0
fi

case "${PROBE_URL}" in
  https://*.up.railway.app | https://aiuniverse.rsvp | https://www.aiuniverse.rsvp) ;;
  *)
    echo "::error::Deploy probe URL must be https://*.up.railway.app or https://aiuniverse.rsvp: ${PROBE_URL}"
    exit 1
    ;;
esac

echo "--- HTTP probe ${PROBE_URL}/ (up to ~3 min) ---"
last_code="000"
for attempt in $(seq 1 12); do
  last_code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 "${PROBE_URL}/" 2>/dev/null)" || true
  echo "attempt ${attempt}/12: HTTP ${last_code}"
  if [ "${last_code}" = "200" ]; then
    exit 0
  fi
  sleep 15
done

echo "::error::${PROBE_URL}/ did not return 200 (last HTTP ${last_code}). x-railway-fallback: true means no healthy deployment — check Railway build/runtime logs."
exit 1
