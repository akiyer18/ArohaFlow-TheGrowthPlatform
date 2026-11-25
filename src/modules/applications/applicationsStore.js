/**
 * Applications Store (ADR-0012): one interface, two adapters.
 *
 *   listApplications()                         -> Application[]
 *   listEvents({ from })                       -> StageEvent[] on or after `from`
 *   createApplication(input)                   -> Application
 *   updateApplication(id, patch)               -> void
 *   recordEvent(event)                         -> void
 *
 * Tables: agent_applications, agent_application_events (RLS: user_id = auth.uid()).
 */
import { validateNewApplication } from './rules.js';

export const APPLICATIONS_TABLE = 'agent_applications';
export const EVENTS_TABLE = 'agent_application_events';
export const APPLICATION_COLUMNS =
  'id,company,role,url,location,source,stage,closed_reason,applied_on,stage_changed_on,next_step,next_step_due,notes,action_id';
export const EVENT_COLUMNS = 'application_id,from_stage,to_stage,on_date';

/* ---------- Mapping ---------- */

export function rowToApplication(row) {
  return {
    id: String(row.id),
    company: row.company,
    role: row.role,
    url: row.url ?? null,
    location: row.location ?? null,
    source: row.source ?? null,
    stage: row.stage,
    closedReason: row.closed_reason ?? null,
    appliedOn: row.applied_on ?? null,
    stageChangedOn: row.stage_changed_on ?? null,
    nextStep: row.next_step ?? null,
    nextStepDue: row.next_step_due ?? null,
    notes: row.notes ?? null,
    actionId: row.action_id ?? null,
  };
}

const FIELD_TO_COLUMN = {
  company: 'company',
  role: 'role',
  url: 'url',
  location: 'location',
  source: 'source',
  stage: 'stage',
  closedReason: 'closed_reason',
  appliedOn: 'applied_on',
  stageChangedOn: 'stage_changed_on',
  nextStep: 'next_step',
  nextStepDue: 'next_step_due',
  notes: 'notes',
  actionId: 'action_id',
};

/** Domain patch -> column patch; only keys present are written, empty strings become null. */
export function applicationPatchToRow(patch) {
  const row = {};
  for (const [key, column] of Object.entries(FIELD_TO_COLUMN)) {
    if (!(key in patch)) continue;
    const value = patch[key];
    row[column] = typeof value === 'string' ? value.trim() || null : value ?? null;
  }
  return row;
}

export function rowToEvent(row) {
  return {
    applicationId: String(row.application_id),
    fromStage: row.from_stage ?? null,
    toStage: row.to_stage,
    onDate: row.on_date,
  };
}

function fail(op, error) {
  const err = new Error(`${op} failed: ${error.message ?? error}`);
  err.cause = error;
  throw err;
}

function newRow(input, today) {
  const app = validateNewApplication(input);
  return {
    ...applicationPatchToRow(app),
    stage: app.stage,
    stage_changed_on: today,
    applied_on: app.appliedOn ?? (app.stage === 'saved' ? null : today),
  };
}

/* ---------- Supabase adapter ---------- */

export function createSupabaseApplicationsStore({ client, now = () => new Date() }) {
  const today = () => now().toISOString().slice(0, 10);
  return {
    async listApplications() {
      const { data, error } = await client
        .from(APPLICATIONS_TABLE)
        .select(APPLICATION_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) fail('listApplications', error);
      return (data ?? []).map(rowToApplication);
    },

    async listEvents({ from }) {
      const { data, error } = await client.from(EVENTS_TABLE).select(EVENT_COLUMNS).gte('on_date', from);
      if (error) fail('listEvents', error);
      return (data ?? []).map(rowToEvent);
    },

    async createApplication(input) {
      const row = newRow(input, today());
      const { data, error } = await client.from(APPLICATIONS_TABLE).insert(row).select(APPLICATION_COLUMNS).single();
      if (error) fail('createApplication', error);
      const created = rowToApplication(data);
      await this.recordEvent({ applicationId: created.id, fromStage: null, toStage: created.stage, onDate: today() });
      return created;
    },

    async updateApplication(id, patch) {
      const row = { ...applicationPatchToRow(patch), updated_at: now().toISOString() };
      const { error } = await client.from(APPLICATIONS_TABLE).update(row).eq('id', id);
      if (error) fail('updateApplication', error);
    },

    async recordEvent(event) {
      const { error } = await client.from(EVENTS_TABLE).insert({
        application_id: event.applicationId,
        from_stage: event.fromStage,
        to_stage: event.toStage,
        on_date: event.onDate,
      });
      if (error) fail('recordEvent', error);
    },
  };
}

/* ---------- In-memory adapter (local mode, demo data, tests) ---------- */

export function createMemoryApplicationsStore({
  applications = [],
  events = [],
  now = () => new Date(),
  rand = Math.random,
} = {}) {
  const state = { applications: structuredClone(applications), events: structuredClone(events) };
  const today = () => now().toISOString().slice(0, 10);
  return {
    async listApplications() {
      return structuredClone(state.applications);
    },
    async listEvents({ from }) {
      return structuredClone(state.events.filter((e) => e.onDate >= from));
    },
    async createApplication(input) {
      const created = rowToApplication({ id: `app-${rand().toString(36).slice(2, 10)}`, ...newRow(input, today()) });
      state.applications.unshift(created);
      state.events.push({ applicationId: created.id, fromStage: null, toStage: created.stage, onDate: today() });
      return structuredClone(created);
    },
    async updateApplication(id, patch) {
      state.applications = state.applications.map((a) => (a.id === id ? { ...a, ...structuredClone(patch) } : a));
    },
    async recordEvent(event) {
      state.events.push(structuredClone(event));
    },
  };
}
