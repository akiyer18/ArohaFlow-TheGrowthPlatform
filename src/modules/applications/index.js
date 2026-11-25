/**
 * Applications module (ADR-0012). Screens call these; they never talk to tables.
 * Production: Supabase store (RLS per user). Local: in-memory store from the fixture.
 */
import { buildApplicationsFixture } from './applicationsFixture.js';
import { createMemoryApplicationsStore, createSupabaseApplicationsStore } from './applicationsStore.js';
import { addDays, moveStage } from './rules.js';

export * from './rules.js';
export * from './applicationsStore.js';

export function localDateKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let defaultStore = null;

export async function getApplicationsStore() {
  if (defaultStore) return defaultStore;
  const { isLocalDataSource } = await import('../../config/appConfig.js');
  if (isLocalDataSource) {
    defaultStore = createMemoryApplicationsStore(buildApplicationsFixture(localDateKey()));
  } else {
    const { supabase } = await import('../../config/supabase.js');
    defaultStore = createSupabaseApplicationsStore({ client: supabase });
  }
  return defaultStore;
}

/** Applications plus the last 35 days of stage events (enough for this week and a month of movement). */
export async function getApplications({ today = localDateKey(), store } = {}) {
  const s = store ?? (await getApplicationsStore());
  const [applications, events] = await Promise.all([
    s.listApplications(),
    s.listEvents({ from: addDays(today, -35) }),
  ]);
  return { today, applications, events };
}

/** Moves an Application and records the stage event. Returns { patch, event } for optimistic UI. */
export async function moveApplication({ app, toStage, today = localDateKey(), closedReason = null, store }) {
  const s = store ?? (await getApplicationsStore());
  const move = moveStage(app, toStage, today, closedReason);
  await s.updateApplication(app.id, move.patch);
  await s.recordEvent(move.event);
  return move;
}
