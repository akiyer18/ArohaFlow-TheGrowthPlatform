import { ActionStatus, BlockKind, DayPlanStatus, MicroactionStatus } from '../domain/statuses.js';

const MAX_ACTIVE_ACTIONS = 3;
const FLEXIBLE_BLOCK_MS = 2 * 60 * 60 * 1000;

function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCandidateActions(actions) {
  return (actions ?? []).map((action) => ({
    title: action.title,
    microactions: (action.microactions ?? []).map((m) => ({ title: m.title })),
  }));
}

/**
 * Edit Weekly Plan candidates in the Store without committing Goals.
 * @param {{ store: object, clock: { now(): Date } }} deps
 * @param {{ actions: Array<{ title: string, microactions?: Array<{ title: string }> }> }} input
 */
export async function editWeeklyPlan(deps, input) {
  const { store, clock } = deps;
  const existing = await store.getWeeklyPlanProposal();
  if (!existing) {
    throw new Error('No Weekly Plan proposal to edit');
  }
  if (existing.committed) {
    throw new Error('Weekly Plan proposal already accepted');
  }

  const proposal = {
    ...existing,
    actions: normalizeCandidateActions(input.actions),
    committed: false,
    editedAt: clock.now().toISOString(),
  };

  await store.saveWeeklyPlanProposal(proposal);
  await store.appendAgentActivity({
    type: 'edit_weekly_plan',
    summary: `Edited Weekly Plan proposal (${proposal.actions.length} Action candidate(s))`,
    at: clock.now().toISOString(),
  });

  return proposal;
}

/**
 * Accept Weekly Plan candidates into Active Actions / Open Microactions.
 * Does not lock any Day Plan.
 * @param {{ store: object, clock: { now(): Date } }} deps
 * @param {{ actions?: Array<{ title: string, microactions?: Array<{ title: string }> }> }} [input]
 */
export async function acceptWeeklyPlan(deps, input = {}) {
  const { store, clock } = deps;
  const existing = await store.getWeeklyPlanProposal();
  if (!existing) {
    throw new Error('No Weekly Plan proposal to accept');
  }
  if (existing.committed) {
    throw new Error('Weekly Plan proposal already accepted');
  }

  const candidateActions = input.actions
    ? normalizeCandidateActions(input.actions)
    : existing.actions ?? [];

  const activeActions = await store.listActiveActions();
  const wipRemaining = Math.max(0, MAX_ACTIVE_ACTIONS - activeActions.length);
  const toAccept = candidateActions.slice(0, wipRemaining);

  const goals = await store.listGoals();
  const goal = goals.find((g) => g.id === existing.goalId);
  if (!goal) {
    throw new Error(`Goal not found: ${existing.goalId}`);
  }

  const acceptedActions = toAccept.map((action) => ({
    id: newId('action'),
    title: action.title,
    status: ActionStatus.ACTIVE,
    microactions: (action.microactions ?? []).map((m) => ({
      id: newId('ma'),
      title: m.title,
      status: MicroactionStatus.OPEN,
    })),
  }));

  goal.actions = [...(goal.actions ?? []), ...acceptedActions];
  await store.seedGoals(goals);

  const proposal = {
    ...existing,
    actions: acceptedActions,
    wipRemaining: Math.max(0, wipRemaining - acceptedActions.length),
    committed: true,
    acceptedAt: clock.now().toISOString(),
  };
  await store.saveWeeklyPlanProposal(proposal);
  await store.appendAgentActivity({
    type: 'accept_weekly_plan',
    summary: `Accepted Weekly Plan: ${acceptedActions.length} Action(s) for Goal ${existing.goalId}`,
    at: clock.now().toISOString(),
  });

  return proposal;
}

function workWindowStart(dateKey) {
  return Date.parse(`${dateKey}T09:00:00.000Z`);
}

/**
 * Place an accepted Microaction onto a Day Plan for a date without locking.
 * @param {{ store: object, clock: { now(): Date, todayDateKey(): string } }} deps
 * @param {{ microactionId: string, date: string }} input
 */
export async function scheduleMicroaction(deps, input) {
  const { store, clock } = deps;
  const { microactionId, date: dateKey } = input;
  if (!microactionId || !dateKey) {
    throw new Error('scheduleMicroaction requires microactionId and date');
  }

  const micro = await store.getMicroaction(microactionId);
  if (!micro) {
    throw new Error(`Microaction not found: ${microactionId}`);
  }

  const existing = await store.getDayPlan(dateKey);
  if (existing?.status === DayPlanStatus.LOCKED) {
    throw new Error(`Day Plan for ${dateKey} is Locked; Unlock before scheduling`);
  }

  const blocks = existing?.blocks ? structuredClone(existing.blocks) : [];
  if (!blocks.some((b) => b.microactionId === microactionId)) {
    const flexCount = blocks.filter((b) => b.kind === BlockKind.FLEXIBLE).length;
    const startMs = workWindowStart(dateKey) + flexCount * FLEXIBLE_BLOCK_MS;
    blocks.push({
      id: `flex-${microactionId}`,
      kind: BlockKind.FLEXIBLE,
      purpose: 'deep-work',
      title: micro.title,
      microactionId,
      publishToCalendar: Boolean(micro.publishToCalendar),
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(startMs + FLEXIBLE_BLOCK_MS).toISOString(),
    });
  }

  const plan = {
    ...(existing ?? {}),
    date: dateKey,
    status: DayPlanStatus.PROPOSED,
    blocks,
    intention: existing?.intention ?? null,
  };

  await store.saveDayPlan(plan);
  await store.appendDayPlanChange({
    date: dateKey,
    type: 'schedule',
    at: clock.now().toISOString(),
    blocks: structuredClone(plan.blocks),
  });
  await store.appendAgentActivity({
    type: 'schedule_microaction',
    summary: `Scheduled Microaction ${microactionId} onto ${dateKey}`,
    at: clock.now().toISOString(),
  });

  return plan;
}
