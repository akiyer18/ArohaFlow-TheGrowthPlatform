/**
 * Application rules (ADR-0012). Pure functions over plain data.
 *
 * Application: { id, company, role, url?, location?, source?, stage, closedReason?,
 *                appliedOn?, stageChangedOn, nextStep?, nextStepDue?, notes?, actionId? }
 * Stage event: { applicationId, fromStage, toStage, onDate }
 */

export const STAGES = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed', label: 'Closed' },
];

export const OPEN_STAGES = ['saved', 'applied', 'interviewing', 'offer'];
export const CLOSED_REASONS = ['Rejected', 'Withdrawn', 'No reply', 'Accepted'];

/** Days without movement after which an Application waiting on the other side earns a follow-up. */
export const FOLLOW_UP_AFTER_DAYS = 10;
export const SOON_DAYS = 3;

/* ---------- Dates ---------- */

export function addDays(dateKey, n) {
  const ms = Date.parse(`${dateKey}T12:00:00.000Z`) + n * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T12:00:00.000Z`) - Date.parse(`${fromKey}T12:00:00.000Z`)) / 86400000);
}

export function weekStart(dateKey) {
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return addDays(dateKey, -((day + 6) % 7));
}

/* ---------- Single Application ---------- */

export function stageLabel(stageId) {
  return STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

export function isOpen(app) {
  return OPEN_STAGES.includes(app.stage);
}

/** overdue | today | soon | later | null (no dated next step) */
export function nextStepState(app, today) {
  if (!isOpen(app) || !app.nextStepDue) return null;
  const d = daysBetween(today, app.nextStepDue);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= SOON_DAYS) return 'soon';
  return 'later';
}

/**
 * Waiting on the other side with no dated next step and no movement for
 * FOLLOW_UP_AFTER_DAYS: a nudge, never a failure.
 */
export function needsFollowUp(app, today) {
  if (!['applied', 'interviewing'].includes(app.stage)) return false;
  if (app.nextStepDue) return false;
  const since = app.stageChangedOn ?? app.appliedOn;
  return Boolean(since) && daysBetween(since, today) >= FOLLOW_UP_AFTER_DAYS;
}

export function daysInStage(app, today) {
  const since = app.stageChangedOn ?? app.appliedOn;
  return since ? Math.max(0, daysBetween(since, today)) : null;
}

/**
 * The patch and the event for moving an Application to another stage.
 * Moving to applied stamps appliedOn once; closing needs a reason; reopening clears it.
 */
export function moveStage(app, toStage, today, closedReason = null) {
  if (!STAGES.some((s) => s.id === toStage)) throw new Error(`Unknown stage ${toStage}`);
  if (toStage === 'closed' && !closedReason) throw new Error('Closing an application needs a reason.');
  const patch = {
    stage: toStage,
    stageChangedOn: today,
    closedReason: toStage === 'closed' ? closedReason : null,
  };
  if (toStage === 'applied' && !app.appliedOn) patch.appliedOn = today;
  if (toStage === 'closed') {
    patch.nextStep = null;
    patch.nextStepDue = null;
  }
  return {
    patch,
    event: { applicationId: app.id, fromStage: app.stage, toStage, onDate: today },
  };
}

export function validateNewApplication(input) {
  const company = input?.company?.trim();
  const role = input?.role?.trim();
  if (!company) throw new Error('Add the company.');
  if (!role) throw new Error('Add the role.');
  const stage = input.stage ?? 'saved';
  if (!OPEN_STAGES.includes(stage)) throw new Error('A new application starts in an open stage.');
  if (input.nextStepDue && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextStepDue)) throw new Error('Pick a date for the next step.');
  if (input.url && !/^https?:\/\//i.test(input.url.trim())) throw new Error('The link should start with http.');
  return {
    ...input,
    company,
    role,
    stage,
    url: input.url?.trim() || null,
    nextStep: input.nextStep?.trim() || null,
    nextStepDue: input.nextStepDue || null,
  };
}

/* ---------- The screen's read ---------- */

const NEXT_ORDER = { overdue: 0, today: 1, soon: 2, later: 3 };

export function buildApplicationsView({ applications, events = [], today }) {
  const columns = STAGES.filter((s) => s.id !== 'closed').map((stage) => ({
    ...stage,
    items: applications
      .filter((a) => a.stage === stage.id)
      .sort((a, b) => (b.stageChangedOn ?? '').localeCompare(a.stageChangedOn ?? '')),
  }));

  const closed = applications
    .filter((a) => a.stage === 'closed')
    .sort((a, b) => (b.stageChangedOn ?? '').localeCompare(a.stageChangedOn ?? ''));

  const nextSteps = applications
    .map((app) => ({ app, state: nextStepState(app, today) }))
    .filter((r) => r.state)
    .sort((a, b) => NEXT_ORDER[a.state] - NEXT_ORDER[b.state] || a.app.nextStepDue.localeCompare(b.app.nextStepDue));

  const followUps = applications
    .filter((app) => needsFollowUp(app, today))
    .map((app) => ({ app, days: daysInStage(app, today) }))
    .sort((a, b) => b.days - a.days);

  const since = weekStart(today);
  const movesThisWeek = events.filter((e) => e.onDate >= since && e.onDate <= today);

  return {
    today,
    columns,
    closed,
    nextSteps,
    followUps,
    stats: {
      open: applications.filter(isOpen).length,
      interviewing: applications.filter((a) => a.stage === 'interviewing').length,
      offers: applications.filter((a) => a.stage === 'offer').length,
      movedThisWeek: new Set(movesThisWeek.map((e) => e.applicationId)).size,
    },
  };
}
