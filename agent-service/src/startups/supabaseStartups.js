/**
 * Startups repository over Supabase (database/startups-store.sql). Same interface as the file
 * repository in findStartups.js: load() -> { lastRun, companies }, save({ companies, lastRun }),
 * setStatus(id, status). On first load, an empty table is filled from `seed` (the old
 * career-data/data/startups.json), so nothing already found is looked up again.
 */
import { nameKey } from './findStartups.js';

const COMPANIES = 'agent_startups';
const RUNS = 'agent_startup_runs';
const PAGE = 1000;

function check(error, action) {
  if (!error) return;
  const message = error.message ?? String(error);
  const hint = /schema cache|does not exist/i.test(message) ? ' Run database/startups-store.sql in Supabase.' : '';
  throw new Error(`Startups store ${action}: ${message}.${hint}`);
}

function toRow(company) {
  return {
    name_key: nameKey(company.name),
    name: company.name,
    domain: company.domain ?? null,
    verdict: company.verdict,
    status: company.status ?? null,
    fit: company.fit ?? null,
    checked_at: company.checkedAt ?? null,
    payload: company,
    updated_at: new Date().toISOString(),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ seed?: { load: () => Promise<{ lastRun: object | null, companies: object[] }> } | null }} [options]
 */
export function createSupabaseStartupsRepo(client, { seed = null } = {}) {
  async function upsert(companies) {
    const rows = companies.filter((c) => nameKey(c.name)).map(toRow);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await client.from(COMPANIES).upsert(rows.slice(i, i + 500), { onConflict: 'name_key' });
      check(error, 'save');
    }
  }

  async function recordRun(lastRun) {
    if (!lastRun?.ranAt) return;
    const { error } = await client.from(RUNS).upsert({ ran_at: lastRun.ranAt, summary: lastRun }, { onConflict: 'ran_at' });
    check(error, 'save run');
  }

  async function readAll() {
    const companies = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(COMPANIES).select('payload').order('name_key').range(from, from + PAGE - 1);
      check(error, 'load');
      companies.push(...(data ?? []).map((r) => r.payload));
      if (!data || data.length < PAGE) return companies;
    }
  }

  return {
    async load() {
      const companies = await readAll();
      const { data, error } = await client.from(RUNS).select('summary').order('ran_at', { ascending: false }).limit(1).maybeSingle();
      check(error, 'load run');
      if (!companies.length && seed) {
        const old = await seed.load();
        if (old.companies.length) {
          await upsert(old.companies);
          await recordRun(old.lastRun);
          return { lastRun: old.lastRun ?? null, companies: old.companies };
        }
      }
      return { lastRun: data?.summary ?? null, companies };
    },

    async save({ companies, lastRun }) {
      await upsert(companies);
      await recordRun(lastRun);
    },

    async setStatus(id, status) {
      const { data, error } = await client.from(COMPANIES).select('name_key,payload').eq('domain', id).limit(1).maybeSingle();
      check(error, 'load');
      if (!data) throw new Error(`Startup not found: ${id}`);
      const company = { ...data.payload, status };
      const { error: writeError } = await client
        .from(COMPANIES)
        .update({ status, payload: company, updated_at: new Date().toISOString() })
        .eq('name_key', data.name_key);
      check(writeError, 'update');
      return company;
    },
  };
}
