/**
 * Copy public.meeting_requests from an old database to a new Supabase project.
 * Default: dry-run (counts only). Pass --apply to upsert missing rows by primary key.
 */
import { createClient } from '@supabase/supabase-js';

export const TABLE = 'meeting_requests';
export const BATCH_SIZE = 100;

/**
 * @param {Record<string, string | undefined>} env
 */
export function resolveClientsFromEnv(env = process.env) {
  const newUrl = env.NEW_SUPABASE_URL;
  const newKey = env.NEW_SERVICE_ROLE_KEY;
  if (!newUrl || !newKey) {
    throw new Error('NEW_SUPABASE_URL and NEW_SERVICE_ROLE_KEY are required');
  }

  const directOldUrl = env.OLD_SUPABASE_URL;
  const directOldKey = env.OLD_SERVICE_ROLE_KEY;
  const proxyOldUrl = env.OLD_PROXY_URL;
  const proxyOldSecret = env.OLD_PROXY_SECRET;

  const hasDirect = Boolean(directOldUrl && directOldKey);
  const hasProxy = Boolean(proxyOldUrl && proxyOldSecret);
  if (hasDirect && hasProxy) {
    throw new Error('Set either OLD_SUPABASE_URL + OLD_SERVICE_ROLE_KEY or OLD_PROXY_URL + OLD_PROXY_SECRET, not both');
  }
  if (!hasDirect && !hasProxy) {
    throw new Error(
      'Old source requires OLD_SUPABASE_URL + OLD_SERVICE_ROLE_KEY or OLD_PROXY_URL + OLD_PROXY_SECRET',
    );
  }

  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const oldClient = hasDirect
    ? createClient(directOldUrl, directOldKey, clientOptions)
    : createClient(proxyOldUrl, proxyOldSecret, clientOptions);
  const newClient = createClient(newUrl, newKey, clientOptions);

  return { oldClient, newClient };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {number} from
 * @param {number} to
 */
async function fetchOldBatch(client, from, to) {
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .order('id', { ascending: true })
    .range(from, to);
  if (error) throw new Error(`read failed: ${error.message}`);
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} ids
 */
async function fetchExistingIds(client, ids) {
  if (ids.length === 0) return new Set();
  const { data, error } = await client.from(TABLE).select('id').in('id', ids);
  if (error) throw new Error(`existence check failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.id));
}

/**
 * @param {{
 *   oldClient: import('@supabase/supabase-js').SupabaseClient;
 *   newClient: import('@supabase/supabase-js').SupabaseClient;
 *   apply?: boolean;
 *   batchSize?: number;
 * }} opts
 */
export async function copyMeetingRequests(opts) {
  const { oldClient, newClient, apply = false, batchSize = BATCH_SIZE } = opts;
  const counts = { read: 0, wouldWrite: 0, written: 0, skipped: 0 };

  let offset = 0;
  for (;;) {
    const batch = await fetchOldBatch(oldClient, offset, offset + batchSize - 1);
    if (batch.length === 0) break;

    counts.read += batch.length;
    const ids = batch.map((row) => row.id);
    const existing = await fetchExistingIds(newClient, ids);
    const toWrite = batch.filter((row) => !existing.has(row.id));
    counts.skipped += batch.length - toWrite.length;
    counts.wouldWrite += toWrite.length;

    if (apply && toWrite.length > 0) {
      const { error } = await newClient.from(TABLE).upsert(toWrite, { onConflict: 'id' });
      if (error) throw new Error(`upsert failed: ${error.message}`);
      counts.written += toWrite.length;
    }

    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  return counts;
}

/** @param {{ read: number; wouldWrite: number; written: number; skipped: number }} counts */
export function formatCounts(counts) {
  return `read=${counts.read} wouldWrite=${counts.wouldWrite} written=${counts.written} skipped=${counts.skipped}`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { oldClient, newClient } = resolveClientsFromEnv();
  const counts = await copyMeetingRequests({ oldClient, newClient, apply });
  console.log(formatCounts(counts));
}

const isMain = import.meta.url === new URL(process.argv[1], 'file:').href;
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : 'copy failed');
    process.exit(1);
  });
}
