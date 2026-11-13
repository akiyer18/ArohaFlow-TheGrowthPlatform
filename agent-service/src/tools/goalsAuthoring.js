import { ActionStatus, MicroactionStatus } from '../domain/statuses.js';

const MAX_ACTIVE_ACTIONS = 3;

function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create or update a Goal (title + optional id). Persists via Store.
 * @param {{ store: object }} deps
 * @param {{ id?: string, title: string }} input
 */
export async function upsertGoal(deps, input) {
  const { store } = deps;
  if (!input?.title?.trim()) {
    throw new Error('upsertGoal requires title');
  }

  const goals = await store.listGoals();
  const id = input.id?.trim() || newId('goal');
  const existingIdx = goals.findIndex((g) => g.id === id);
  const goal =
    existingIdx >= 0
      ? { ...goals[existingIdx], title: input.title.trim() }
      : { id, title: input.title.trim(), actions: [] };

  if (existingIdx >= 0) goals[existingIdx] = goal;
  else goals.push(goal);

  await store.seedGoals(goals);
  return structuredClone(goal);
}

/**
 * Create or update an Action under a Goal. Enforces max 3 Active Actions when status is active.
 * @param {{ store: object }} deps
 * @param {{ goalId: string, id?: string, title: string, status?: string }} input
 */
export async function upsertAction(deps, input) {
  const { store } = deps;
  if (!input?.goalId) throw new Error('upsertAction requires goalId');
  if (!input?.title?.trim()) throw new Error('upsertAction requires title');

  const goals = await store.listGoals();
  const goal = goals.find((g) => g.id === input.goalId);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);

  const id = input.id?.trim() || newId('action');
  const status = input.status ?? ActionStatus.PARKED;
  const actions = goal.actions ?? [];
  const existingIdx = actions.findIndex((a) => a.id === id);
  const previous = existingIdx >= 0 ? actions[existingIdx] : null;

  const becomingActive =
    status === ActionStatus.ACTIVE && previous?.status !== ActionStatus.ACTIVE;
  if (becomingActive) {
    const activeCount = (await store.listActiveActions()).length;
    if (activeCount >= MAX_ACTIVE_ACTIONS) {
      throw new Error(`Max ${MAX_ACTIVE_ACTIONS} Active Actions`);
    }
  }

  const action =
    existingIdx >= 0
      ? {
          ...actions[existingIdx],
          title: input.title.trim(),
          status,
        }
      : {
          id,
          title: input.title.trim(),
          status,
          microactions: [],
        };

  if (existingIdx >= 0) actions[existingIdx] = action;
  else actions.push(action);
  goal.actions = actions;

  await store.seedGoals(goals);
  return structuredClone({ ...action, goalId: goal.id });
}

/**
 * Create or update a Microaction under an Action.
 * @param {{ store: object }} deps
 * @param {{ actionId: string, id?: string, title: string, status?: string }} input
 */
export async function upsertMicroaction(deps, input) {
  const { store } = deps;
  if (!input?.actionId) throw new Error('upsertMicroaction requires actionId');
  if (!input?.title?.trim()) throw new Error('upsertMicroaction requires title');

  const goals = await store.listGoals();
  let foundAction = null;
  let foundGoal = null;
  for (const goal of goals) {
    for (const action of goal.actions || []) {
      if (action.id === input.actionId) {
        foundAction = action;
        foundGoal = goal;
        break;
      }
    }
    if (foundAction) break;
  }
  if (!foundAction) throw new Error(`Action not found: ${input.actionId}`);

  const id = input.id?.trim() || newId('ma');
  const status = input.status ?? MicroactionStatus.OPEN;
  const micros = foundAction.microactions ?? [];
  const existingIdx = micros.findIndex((m) => m.id === id);

  const micro =
    existingIdx >= 0
      ? { ...micros[existingIdx], title: input.title.trim(), status }
      : { id, title: input.title.trim(), status };

  if (existingIdx >= 0) micros[existingIdx] = micro;
  else micros.push(micro);
  foundAction.microactions = micros;

  await store.seedGoals(goals);
  return structuredClone({
    ...micro,
    actionId: foundAction.id,
    goalId: foundGoal.id,
  });
}
