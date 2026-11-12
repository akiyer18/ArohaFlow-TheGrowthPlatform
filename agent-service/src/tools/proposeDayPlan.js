import { BlockKind, DayPlanStatus } from '../domain/statuses.js';

const MAX_MICROACTIONS_PER_DAY = 5;
const MAX_ACTIVE_ACTIONS = 3;
/** Preferred Flexible Block length (~2h Microaction gap). */
const FLEXIBLE_BLOCK_MS = 2 * 60 * 60 * 1000;

function fixedBlocksFor(dateKey) {
  return [
    {
      id: `fixed-gym-${dateKey}`,
      kind: BlockKind.FIXED,
      purpose: 'gym',
      title: 'Gym',
      startAt: `${dateKey}T07:00:00.000Z`,
      endAt: `${dateKey}T08:00:00.000Z`,
    },
    {
      id: `fixed-work-${dateKey}`,
      kind: BlockKind.FIXED,
      purpose: 'work-window',
      title: 'Work window',
      startAt: `${dateKey}T09:00:00.000Z`,
      endAt: `${dateKey}T18:00:00.000Z`,
    },
    {
      id: `fixed-wind-${dateKey}`,
      kind: BlockKind.FIXED,
      purpose: 'wind-down',
      title: 'Wind-down',
      startAt: `${dateKey}T19:00:00.000Z`,
      endAt: `${dateKey}T22:00:00.000Z`,
    },
  ];
}

function workWindowFor(dateKey) {
  const work = fixedBlocksFor(dateKey).find((b) => b.purpose === 'work-window');
  return {
    startMs: Date.parse(work.startAt),
    endMs: Date.parse(work.endAt),
  };
}

function eventOverlapsDate(event, dateKey) {
  const dayStart = Date.parse(`${dateKey}T00:00:00.000Z`);
  const dayEnd = Date.parse(`${dateKey}T23:59:59.999Z`);
  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt);
  return start <= dayEnd && end >= dayStart;
}

function clipToWindow(startMs, endMs, windowStart, windowEnd) {
  return {
    startMs: Math.max(startMs, windowStart),
    endMs: Math.min(endMs, windowEnd),
  };
}

function occupiedIntervals(events, dateKey, window) {
  return events
    .filter((event) => eventOverlapsDate(event, dateKey))
    .map((event) =>
      clipToWindow(Date.parse(event.startAt), Date.parse(event.endAt), window.startMs, window.endMs),
    )
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

function freeGaps(window, occupied) {
  const gaps = [];
  let cursor = window.startMs;
  for (const busy of occupied) {
    if (busy.startMs > cursor) {
      gaps.push({ startMs: cursor, endMs: busy.startMs });
    }
    cursor = Math.max(cursor, busy.endMs);
  }
  if (cursor < window.endMs) {
    gaps.push({ startMs: cursor, endMs: window.endMs });
  }
  return gaps;
}

function placeFlexibleBlocks(microactions, dateKey, events) {
  const window = workWindowFor(dateKey);
  const gaps = freeGaps(window, occupiedIntervals(events, dateKey, window));
  const flexible = [];
  let microIndex = 0;

  for (const gap of gaps) {
    let cursor = gap.startMs;
    while (microIndex < microactions.length && cursor + FLEXIBLE_BLOCK_MS <= gap.endMs) {
      const micro = microactions[microIndex];
      const endMs = cursor + FLEXIBLE_BLOCK_MS;
      flexible.push({
        id: `flex-${micro.id}`,
        kind: BlockKind.FLEXIBLE,
        purpose: 'deep-work',
        title: micro.title,
        microactionId: micro.id,
        publishToCalendar: Boolean(micro.publishToCalendar),
        startAt: new Date(cursor).toISOString(),
        endAt: new Date(endMs).toISOString(),
      });
      cursor = endMs;
      microIndex += 1;
    }
  }

  return flexible;
}

/**
 * @param {{ store: object, clock: { todayDateKey(): string, now(): Date } }} deps
 * @param {{ date?: string }} [options]
 */
export async function proposeDayPlan(deps, options = {}) {
  const { store, clock } = deps;
  const dateKey = options.date ?? clock.todayDateKey();
  const existing = await store.getDayPlan(dateKey);
  if (existing?.status === DayPlanStatus.LOCKED) {
    return existing;
  }

  const activeActions = await store.listActiveActions();
  const allowedActionIds = new Set(activeActions.slice(0, MAX_ACTIVE_ACTIONS).map((a) => a.id));
  const open = (await store.listOpenMicroactions()).filter((m) => allowedActionIds.has(m.actionId));
  const selected = open.slice(0, MAX_MICROACTIONS_PER_DAY);
  const events = await store.listCalendarEvents();
  const flexible = placeFlexibleBlocks(selected, dateKey, events);

  const plan = {
    date: dateKey,
    status: DayPlanStatus.PROPOSED,
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
