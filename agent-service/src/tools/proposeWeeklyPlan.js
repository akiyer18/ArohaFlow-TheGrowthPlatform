const MAX_ACTIVE_ACTIONS = 3;

/**
 * Saturday Weekly Plan: LLM proposes Goal → Action → Microaction candidates.
 * Candidates are not committed to Goals or Locked Day Plans.
 *
 * @param {{ store: object, llm: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ goalId: string }} input
 */
export async function proposeWeeklyPlan(deps, input) {
  const { store, llm, clock } = deps;
  if (!llm?.proposeWeeklyPlan) {
    throw new Error('LLM port required for propose_weekly_plan');
  }

  const goals = await store.listGoals();
  const goal = goals.find((g) => g.id === input.goalId);
  if (!goal) {
    throw new Error(`Goal not found: ${input.goalId}`);
  }

  const activeActions = await store.listActiveActions();
  const wipRemaining = Math.max(0, MAX_ACTIVE_ACTIONS - activeActions.length);

  const raw = await llm.proposeWeeklyPlan({
    goal: { id: goal.id, title: goal.title },
    wipRemaining,
  });

  const actions = (raw?.actions ?? [])
    .slice(0, wipRemaining)
    .map((action) => ({
      title: action.title,
      microactions: (action.microactions ?? []).map((m) => ({ title: m.title })),
    }));

  const proposal = {
    goalId: goal.id,
    actions,
    wipRemaining,
    committed: false,
    proposedAt: clock.now().toISOString(),
  };

  await store.saveWeeklyPlanProposal(proposal);
  await store.appendAgentActivity({
    type: 'propose_weekly_plan',
    summary: `Weekly Plan proposed ${actions.length} Action candidate(s) for Goal ${goal.id}`,
    at: clock.now().toISOString(),
  });

  return proposal;
}
