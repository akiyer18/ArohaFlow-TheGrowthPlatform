const MAX_MICROACTIONS_PER_DAY = 5;
const MAX_ACTIVE_ACTIONS = 3;

function fixedBlocksFor(dateKey) {
  return [
    {
      id: `fixed-gym-${dateKey}`,
      kind: 'fixed',
      purpose: 'gym',
      title: 'Gym',
      startAt: `${dateKey}T07:00:00.000Z`,
      endAt: `${dateKey}T08:00:00.000Z`,
    },
    {
      id: `fixed-work-${dateKey}`,
      kind: 'fixed',
      purpose: 'work-window',
      title: 'Work window',
      startAt: `${dateKey}T09:00:00.000Z`,
      endAt: `${dateKey}T18:00:00.000Z`,
    },
    {
      id: `fixed-wind-${dateKey}`,
      kind: 'fixed',
      purpose: 'wind-down',
      title: 'Wind-down',
      startAt: `${dateKey}T19:00:00.000Z`,
      endAt: `${dateKey}T22:00:00.000Z`,
    },
  ];
}

/**
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ date?: string }} [options]
 */
export async function proposeDayPlan(deps, options = {}) {
  const { store, clock } = deps;
  const dateKey = options.date ?? clock.todayDateKey();
  const existing = await store.getDayPlan(dateKey);
  if (existing?.status === 'locked') {
    return existing;
  }

  const activeActions = await store.listActiveActions();
  const allowedActionIds = new Set(activeActions.slice(0, MAX_ACTIVE_ACTIONS).map((a) => a.id));
  const open = (await store.listOpenMicroactions()).filter((m) => allowedActionIds.has(m.actionId));
  const selected = open.slice(0, MAX_MICROACTIONS_PER_DAY);
  const flexible = selected.map((micro, index) => {
    const hour = 10 + index * 2;
    return {
      id: `flex-${micro.id}`,
      kind: 'flexible',
      purpose: 'deep-work',
      title: micro.title,
      microactionId: micro.id,
      publishToCalendar: Boolean(micro.publishToCalendar),
      startAt: `${dateKey}T${String(hour).padStart(2, '0')}:00:00.000Z`,
      endAt: `${dateKey}T${String(hour + 2).padStart(2, '0')}:00:00.000Z`,
    };
  });

  const plan = {
    date: dateKey,
    status: 'proposed',
    blocks: [...fixedBlocksFor(dateKey), ...flexible],
  };

  await store.saveDayPlan(plan);
  await store.appendDayPlanChange({
    date: dateKey,
    type: 'propose',
    at: clock.now().toISOString(),
  });
  await store.appendAgentActivity({
    type: 'propose_day_plan',
    summary: `Proposed Day Plan with ${flexible.length} Microaction Block(s)`,
    at: clock.now().toISOString(),
  });

  return plan;
}
