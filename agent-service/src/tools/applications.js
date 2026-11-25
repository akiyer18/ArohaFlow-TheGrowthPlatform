/**
 * Applications tools (ADR-0012). Same pure rules as the web app (src/modules/applications),
 * so a move made by the agent and a move made on the board record the same stage event.
 */
import { randomUUID } from 'node:crypto';
import {
  buildApplicationsView,
  moveStage,
  validateNewApplication,
} from '../../../src/modules/applications/rules.js';

function addDays(dateKey, n) {
  return new Date(Date.parse(`${dateKey}T12:00:00.000Z`) + n * 86400000).toISOString().slice(0, 10);
}

async function getApplicationOrThrow(store, id) {
  if (!id || typeof id !== 'string') throw new Error('Application id is required');
  const app = (await store.listApplications()).find((a) => a.id === id);
  if (!app) throw new Error(`Application ${id} not found`);
  return app;
}

/** Board read: applications, next steps, follow-ups and this week's movement. */
export async function listApplications({ store, clock }) {
  const today = clock.todayDateKey();
  const applications = await store.listApplications();
  const events = await store.listApplicationEvents({ from: addDays(today, -35) });
  const view = buildApplicationsView({ applications, events, today });
  return {
    applications,
    stats: view.stats,
    nextSteps: view.nextSteps.map(({ app, state }) => ({ id: app.id, company: app.company, nextStep: app.nextStep, nextStepDue: app.nextStepDue, state })),
    followUps: view.followUps.map(({ app, days }) => ({ id: app.id, company: app.company, role: app.role, daysQuiet: days })),
  };
}

export async function addApplication({ store, clock }, input) {
  const today = clock.todayDateKey();
  const valid = validateNewApplication(input);
  const application = {
    id: randomUUID(),
    company: valid.company,
    role: valid.role,
    url: valid.url,
    location: valid.location?.trim() || null,
    source: valid.source?.trim() || null,
    stage: valid.stage,
    closedReason: null,
    appliedOn: valid.stage === 'saved' ? null : today,
    stageChangedOn: today,
    nextStep: valid.nextStep,
    nextStepDue: valid.nextStepDue,
    notes: valid.notes?.trim() || null,
    actionId: valid.actionId ?? null,
  };
  await store.upsertApplication(application);
  await store.appendApplicationEvent({ applicationId: application.id, fromStage: null, toStage: application.stage, onDate: today });
  return application;
}

export async function moveApplication({ store, clock }, input) {
  const today = clock.todayDateKey();
  const app = await getApplicationOrThrow(store, input?.id);
  const { patch, event } = moveStage(app, input.toStage, today, input.closedReason ?? null);
  const updated = { ...app, ...patch };
  await store.upsertApplication(updated);
  await store.appendApplicationEvent(event);
  return updated;
}

export async function setApplicationNextStep({ store }, input) {
  const app = await getApplicationOrThrow(store, input?.id);
  if (input.nextStepDue && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextStepDue)) {
    throw new Error('nextStepDue must be YYYY-MM-DD');
  }
  const updated = {
    ...app,
    nextStep: input.nextStep?.trim() || null,
    nextStepDue: input.nextStepDue || null,
  };
  await store.upsertApplication(updated);
  return updated;
}
