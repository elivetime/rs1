#!/usr/bin/env bash
# Read-only Railway report via GraphQL (project token). Copied from ai-stream-clips pattern.
# Usage: RAILWAY_TOKEN=... scripts/railway-staging-diagnose.sh <service-uuid> [deployment-uuid]
set -uo pipefail

SERVICE_ID="${1:?usage: railway-staging-diagnose.sh <service-uuid> [deployment-uuid]}"
DEPLOYMENT_ID="${2:-}"
API="https://backboard.railway.com/graphql/v2"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN must be set}"

gql() {
  local query="$1" vars="${2:-}"
  [ -z "$vars" ] && vars='{}'
  jq -n --arg q "$query" --argjson v "$vars" '{query: $q, variables: $v}' |
    curl -sS --max-time 60 -X POST "$API" \
      -H "Content-Type: application/json" \
      -H "Project-Access-Token: ${RAILWAY_TOKEN}" \
      --data-binary @-
}

token_info="$(gql 'query { projectToken { projectId environmentId } }')"
PROJECT_ID="$(jq -r '.data.projectToken.projectId // empty' <<<"$token_info")"
ENV_ID="$(jq -r '.data.projectToken.environmentId // empty' <<<"$token_info")"
if [ -z "$PROJECT_ID" ] || [ -z "$ENV_ID" ]; then
  echo "projectToken lookup failed: $(jq -c '.errors // .' <<<"$token_info" 2>/dev/null || echo "$token_info")"
  exit 1
fi
echo "Token scope: project ${PROJECT_ID} environment ${ENV_ID}"

if [ "${WAIT_FOR_DEPLOYMENT:-0}" = "1" ] && [ -z "$DEPLOYMENT_ID" ]; then
  echo "::error::Cannot wait for Railway deployment: deployment ID is missing."
  exit 1
fi

rc=0
if [ "${WAIT_FOR_DEPLOYMENT:-0}" = "1" ] && [ -n "$DEPLOYMENT_ID" ]; then
  deadline=$(( $(date +%s) + ${WAIT_TIMEOUT_SECONDS:-1080} ))
  status=""
  while :; do
    status="$(gql 'query($d: String!) { deployment(id: $d) { status } }' \
      "$(jq -n --arg d "$DEPLOYMENT_ID" '{d: $d}')" | jq -r '.data.deployment.status // "UNKNOWN"')"
    echo "$(date -u +%H:%M:%S) deployment ${DEPLOYMENT_ID}: ${status}"
    case "$status" in
      SUCCESS) echo "Railway deployment succeeded."; exit 0 ;;
      FAILED|CRASHED|REMOVED|SKIPPED) break ;;
    esac
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "Timed out waiting for deployment."
      break
    fi
    sleep 15
  done
  echo "::error::Railway deployment ${DEPLOYMENT_ID} ended ${status}; report follows."
  rc=1
fi

echo "--- Services and public domains ---"
services="$(gql 'query($id: String!) { project(id: $id) { name services { edges { node { id name } } } } }' \
  "$(jq -n --arg id "$PROJECT_ID" '{id: $id}')")"
jq -r '.data.project.name // empty | "Project name: \(.)"' <<<"$services"
while IFS=$'\t' read -r sid sname; do
  [ -z "$sid" ] && continue
  doms="$(gql 'query($p: String!, $e: String!, $s: String!) { domains(projectId: $p, environmentId: $e, serviceId: $s) { serviceDomains { domain targetPort } customDomains { domain targetPort } } }' \
    "$(jq -n --arg p "$PROJECT_ID" --arg e "$ENV_ID" --arg s "$sid" '{p: $p, e: $e, s: $s}')")"
  hosts="$(jq -r '[.data.domains.serviceDomains[]?, .data.domains.customDomains[]? | .domain] | join(", ")' <<<"$doms" 2>/dev/null)"
  marker=""
  [ "$sid" = "$SERVICE_ID" ] && marker=" <== deploy target"
  echo "service ${sid} \"${sname}\": ${hosts:-<no domains>}${marker}"
done < <(jq -r '.data.project.services.edges[]?.node | [.id, .name] | @tsv' <<<"$services")

deps="$(gql 'query($p: String!, $e: String!, $s: String!) { deployments(first: 3, input: { projectId: $p, environmentId: $e, serviceId: $s }) { edges { node { id status createdAt } } } }' \
  "$(jq -n --arg p "$PROJECT_ID" --arg e "$ENV_ID" --arg s "$SERVICE_ID" '{p: $p, e: $e, s: $s}')")"
if [ -z "$DEPLOYMENT_ID" ]; then
  DEPLOYMENT_ID="$(jq -r '.data.deployments.edges[0].node.id // empty' <<<"$deps")"
fi
[ -z "$DEPLOYMENT_ID" ] && exit "$rc"

echo "--- Build log tail ---"
gql 'query($d: String!) { buildLogs(deploymentId: $d, limit: 120) { message } }' \
  "$(jq -n --arg d "$DEPLOYMENT_ID" '{d: $d}')" | jq -r '.data.buildLogs[]?.message' | tail -n 60
exit "$rc"
