import { describe, it, expect } from 'vitest';
import {
  APPLICATIONS_TABLE,
  EVENTS_TABLE,
  applicationPatchToRow,
  buildApplicationsView,
  createMemoryApplicationsStore,
  createSupabaseApplicationsStore,
  getApplications,
  moveApplication,
  moveStage,
  needsFollowUp,
  nextStepState,
  rowToApplication,
  validateNewApplication,
} from './index.js';
import { buildApplicationsFixture } from './applicationsFixture.js';

const today = '2026-11-24';
const base = { id: 'a1', company: 'Acme', role: 'Engineer', stage: 'applied', appliedOn: '2026-11-10', stageChangedOn: '2026-11-10' };

describe('Application rules (ADR-0012)', () => {
  it('dates the next step relative to today', () => {
    expect(nextStepState({ ...base, nextStepDue: '2026-11-23' }, today)).toBe('overdue');
    expect(nextStepState({ ...base, nextStepDue: today }, today)).toBe('today');
    expect(nextStepState({ ...base, nextStepDue: '2026-11-27' }, today)).toBe('soon');
    expect(nextStepState({ ...base, nextStepDue: '2026-12-10' }, today)).toBe('later');
    expect(nextStepState({ ...base, stage: 'closed', closedReason: 'Rejected', nextStepDue: '2026-11-23' }, today)).toBeNull();
  });

  it('suggests a follow-up after 10 quiet days only when nothing is scheduled', () => {
    expect(needsFollowUp(base, today)).toBe(true);
    expect(needsFollowUp({ ...base, stageChangedOn: '2026-11-20' }, today)).toBe(false);
    expect(needsFollowUp({ ...base, nextStepDue: '2026-12-01' }, today)).toBe(false);
    expect(needsFollowUp({ ...base, stage: 'saved' }, today)).toBe(false);
  });

  it('moves stages, stamps appliedOn once, and needs a reason to close', () => {
    const saved = { ...base, stage: 'saved', appliedOn: null };
    expect(moveStage(saved, 'applied', today).patch).toMatchObject({ stage: 'applied', appliedOn: today, stageChangedOn: today });
    expect(moveStage(base, 'interviewing', today).patch).not.toHaveProperty('appliedOn');
    expect(() => moveStage(base, 'closed', today)).toThrow('reason');
    const closed = moveStage({ ...base, nextStep: 'x', nextStepDue: today }, 'closed', today, 'Withdrawn');
    expect(closed.patch).toMatchObject({ closedReason: 'Withdrawn', nextStep: null, nextStepDue: null });
    expect(closed.event).toEqual({ applicationId: 'a1', fromStage: 'applied', toStage: 'closed', onDate: today });
  });

  it('validates new applications', () => {
    expect(() => validateNewApplication({ company: '', role: 'x' })).toThrow('company');
    expect(() => validateNewApplication({ company: 'x', role: ' ' })).toThrow('role');
    expect(() => validateNewApplication({ company: 'x', role: 'y', url: 'example.com' })).toThrow('http');
    expect(validateNewApplication({ company: ' Acme ', role: 'Eng' })).toMatchObject({ company: 'Acme', stage: 'saved' });
  });

  it('builds the board, the next steps and the week stats', () => {
    const { applications, events } = buildApplicationsFixture(today);
    const view = buildApplicationsView({ applications, events, today });
    expect(view.columns.map((c) => c.id)).toEqual(['saved', 'applied', 'interviewing', 'offer']);
    expect(view.closed).toHaveLength(1);
    expect(view.nextSteps[0]).toMatchObject({ state: 'overdue', app: { company: 'Initech' } });
    expect(view.followUps.map((f) => f.app.company)).toEqual(['Globex']);
    expect(view.stats).toEqual({ open: 5, interviewing: 1, offers: 1, movedThisWeek: 1 });
  });
});

function createRecordingClient(results = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, ops: [] };
      calls.push(call);
      const builder = {};
      for (const op of ['select', 'insert', 'update', 'eq', 'gte', 'order', 'single']) {
        builder[op] = (...args) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      builder.then = (resolve) => resolve(results[`${table}:${call.ops.map(([o]) => o).join('.')}`] ?? { data: [], error: null });
      return builder;
    },
  };
}

describe('Supabase applications store', () => {
  const now = () => new Date('2026-11-24T09:00:00.000Z');

  it('maps rows both ways and nulls empty strings', () => {
    expect(rowToApplication({ id: 'x', company: 'A', role: 'B', stage: 'saved', next_step_due: '2026-11-30' })).toMatchObject({
      id: 'x',
      nextStepDue: '2026-11-30',
      closedReason: null,
    });
    expect(applicationPatchToRow({ nextStep: '  ', closedReason: null, stage: 'offer' })).toEqual({
      next_step: null,
      closed_reason: null,
      stage: 'offer',
    });
  });

  it('creates an application and records its first stage event', async () => {
    const client = createRecordingClient({
      [`${APPLICATIONS_TABLE}:insert.select.single`]: { data: { id: 'uuid-1', company: 'Acme', role: 'Eng', stage: 'applied' }, error: null },
    });
    const store = createSupabaseApplicationsStore({ client, now });
    const created = await store.createApplication({ company: 'Acme', role: 'Eng', stage: 'applied' });
    expect(created.id).toBe('uuid-1');
    expect(client.calls[0].ops[0][1]).toMatchObject({ company: 'Acme', stage: 'applied', applied_on: '2026-11-24', stage_changed_on: '2026-11-24' });
    expect(client.calls[0].ops[0][1]).not.toHaveProperty('user_id');
    expect(client.calls[1]).toEqual({
      table: EVENTS_TABLE,
      ops: [['insert', { application_id: 'uuid-1', from_stage: null, to_stage: 'applied', on_date: '2026-11-24' }]],
    });
  });

  it('reads events from a date and surfaces errors with the operation', async () => {
    const client = createRecordingClient({
      [`${APPLICATIONS_TABLE}:select.order`]: { data: null, error: { message: 'permission denied' } },
    });
    const store = createSupabaseApplicationsStore({ client, now });
    await store.listEvents({ from: '2026-10-20' });
    expect(client.calls[0].ops).toEqual([['select', 'application_id,from_stage,to_stage,on_date'], ['gte', 'on_date', '2026-10-20']]);
    await expect(store.listApplications()).rejects.toThrow('listApplications failed: permission denied');
  });
});

describe('reads and moves through the store', () => {
  it('moves an application and the board reflects it', async () => {
    const store = createMemoryApplicationsStore(buildApplicationsFixture(today));
    const data = await getApplications({ today, store });
    const globex = data.applications.find((a) => a.company === 'Globex');
    await moveApplication({ app: globex, toStage: 'interviewing', today, store });
    const after = buildApplicationsView(await getApplications({ today, store }));
    expect(after.columns.find((c) => c.id === 'interviewing').items.map((a) => a.company)).toContain('Globex');
    expect(after.stats.movedThisWeek).toBe(2);
    expect(after.followUps).toHaveLength(0);
  });
});
