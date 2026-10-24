import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  copyMeetingRequests,
  formatCounts,
  resolveClientsFromEnv,
} from './copy-meeting-requests.mjs';

const ROW_A = {
  id: '00000000-0000-4000-8000-000000000001',
  token: 'aaa',
  name: 'A',
  email: 'a@example.com',
  company: null,
  role: null,
  phone: null,
  format: 'zoom',
  start_at: '2026-01-01T15:00:00.000Z',
  duration_min: 30,
  visitor_tz: null,
  notes: null,
  status: 'pending',
  meeting_link: null,
  mgmt_note: null,
  created_at: '2026-01-01T10:00:00.000Z',
  decided_at: null,
};

const ROW_B = {
  ...ROW_A,
  id: '00000000-0000-4000-8000-000000000002',
  token: 'bbb',
  email: 'b@example.com',
};

function makeOldClient(rows) {
  return {
    from(table) {
      assert.equal(table, 'meeting_requests');
      return {
        select() {
          return {
            order() {
              return {
                async range(from, to) {
                  const slice = rows.slice(from, to + 1);
                  return { data: slice, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

function makeNewClient({ existingIds = new Set(), upsertLog = [] }) {
  return {
    from(table) {
      assert.equal(table, 'meeting_requests');
      return {
        select(cols) {
          assert.equal(cols, 'id');
          return {
            async in(_col, ids) {
              const data = ids.filter((id) => existingIds.has(id)).map((id) => ({ id }));
              return { data, error: null };
            },
          };
        },
        async upsert(rows, opts) {
          upsertLog.push({ rows, opts });
          for (const row of rows) existingIds.add(row.id);
          return { error: null };
        },
      };
    },
  };
}

describe('resolveClientsFromEnv', () => {
  it('requires NEW vars', () => {
    assert.throws(
      () => resolveClientsFromEnv({ OLD_SUPABASE_URL: 'https://old', OLD_SERVICE_ROLE_KEY: 'k' }),
      /NEW_SUPABASE_URL/,
    );
  });

  it('rejects both old connection modes', () => {
    assert.throws(
      () =>
        resolveClientsFromEnv({
          OLD_SUPABASE_URL: 'https://old',
          OLD_SERVICE_ROLE_KEY: 'k1',
          OLD_PROXY_URL: 'https://proxy',
          OLD_PROXY_SECRET: 'k2',
          NEW_SUPABASE_URL: 'https://new',
          NEW_SERVICE_ROLE_KEY: 'kn',
        }),
      /not both/,
    );
  });
});

describe('copyMeetingRequests', () => {
  it('dry-run reports wouldWrite without writing', async () => {
    const upsertLog = [];
    const newClient = makeNewClient({ upsertLog });
    const counts = await copyMeetingRequests({
      oldClient: makeOldClient([ROW_A, ROW_B]),
      newClient,
      apply: false,
    });
    assert.deepEqual(counts, { read: 2, wouldWrite: 2, written: 0, skipped: 0 });
    assert.equal(upsertLog.length, 0);
    assert.match(formatCounts(counts), /wouldWrite=2 written=0/);
  });

  it('apply upserts missing rows', async () => {
    const upsertLog = [];
    const newClient = makeNewClient({ upsertLog });
    const counts = await copyMeetingRequests({
      oldClient: makeOldClient([ROW_A]),
      newClient,
      apply: true,
    });
    assert.deepEqual(counts, { read: 1, wouldWrite: 1, written: 1, skipped: 0 });
    assert.equal(upsertLog.length, 1);
    assert.equal(upsertLog[0].rows.length, 1);
    assert.equal(upsertLog[0].opts.onConflict, 'id');
  });

  it('skips rows already present on the new database', async () => {
    const existing = new Set([ROW_A.id]);
    const upsertLog = [];
    const counts = await copyMeetingRequests({
      oldClient: makeOldClient([ROW_A, ROW_B]),
      newClient: makeNewClient({ existingIds: existing, upsertLog }),
      apply: true,
    });
    assert.deepEqual(counts, { read: 2, wouldWrite: 1, written: 1, skipped: 1 });
    assert.equal(upsertLog.length, 1);
    assert.equal(upsertLog[0].rows[0].id, ROW_B.id);
  });
});
