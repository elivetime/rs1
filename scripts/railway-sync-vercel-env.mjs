#!/usr/bin/env node
/**
 * Copy a `vercel pull` env file onto a Railway service (dotenv-parsed; skips VERCEL_*).
 * Usage: RAILWAY_TOKEN=... node scripts/railway-sync-vercel-env.mjs <env-file> <service-uuid>
 */
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const API = "https://backboard.railway.com/graphql/v2";
const PLATFORM_PREFIXES = ["VERCEL_", "TURBO_", "NX_"];

const [envFile, serviceId] = process.argv.slice(2);
const token = process.env.RAILWAY_TOKEN;
if (!envFile || !serviceId || !token) {
  console.error("usage: RAILWAY_TOKEN=... railway-sync-vercel-env.mjs <env-file> <service-uuid>");
  process.exit(2);
}

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Project-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    throw new Error(`Railway API ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 500)}`);
  }
  return body.data;
}

const isPlatformKey = (key) => PLATFORM_PREFIXES.some((p) => key.startsWith(p));

const parsed = parseEnv(readFileSync(envFile, "utf8"));
const variables = {};
const skippedEmpty = [];
for (const [key, value] of Object.entries(parsed)) {
  if (isPlatformKey(key)) continue;
  if (value === "") {
    skippedEmpty.push(key);
    continue;
  }
  variables[key] = value;
}

const { projectToken } = await gql("query { projectToken { projectId environmentId } }");
const scope = { projectId: projectToken.projectId, environmentId: projectToken.environmentId, serviceId };

await gql(
  "mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }",
  { input: { ...scope, variables, replace: false, skipDeploys: true } },
);
console.log(`Upserted ${Object.keys(variables).length} variables to Railway service ${serviceId}.`);
if (skippedEmpty.length) console.log(`Skipped empty (sensitive on Vercel): ${skippedEmpty.join(", ")}`);
