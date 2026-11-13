import { MicroactionStatus } from '../domain/statuses.js';

/**
 * @param {{ store: object }} deps
 * @param {{ microactionId: string, dayPlan?: object }} input
 */
export async function startMicroaction(deps, input) {
  const { store } = deps;
  const active = await store.getActiveMicroaction();
  if (active && active.id !== input.microactionId) {
    throw new Error(
      'An Active Microaction is already in progress; park or complete it before starting another',
    );
  }
  if (active && active.id === input.microactionId) {
    return { activeMicroaction: active };
  }

  const dayPlan = input.dayPlan ?? (await store.getDayPlan(input.date));
  if (dayPlan) {
    const next = await resolveNextMicroaction({ dayPlan, store });
    if (next && next.id !== input.microactionId) {
      throw new Error(
        `Open next follows the Day Plan sequence; start ${next.id} before ${input.microactionId}`,
      );
    }
  }

  const updated = await store.setMicroactionStatus(input.microactionId, MicroactionStatus.ACTIVE);
  return { activeMicroaction: updated };
}

/**
 * @param {{ store: object, clock: { now(): Date } }} deps
 * @param {{ microactionId: string, reason?: string }} input
 */
export async function parkMicroaction(deps, input) {
  const { store, clock } = deps;
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
  if (!reason) {
    throw new Error('park_microaction requires a short reason');
  }

  const active = await store.getActiveMicroaction();
  if (!active || active.id !== input.microactionId) {
    throw new Error(`Microaction ${input.microactionId} is not the Active Microaction`);
  }

  const updated = await store.setMicroactionStatus(input.microactionId, MicroactionStatus.PARKED, {
    parkReason: reason,
    parkedAt: clock.now().toISOString(),
  });
  return { activeMicroaction: null, parked: updated };
}

/**
 * Next Microaction for Today: Active if set; else first OPEN on the Day Plan; else first PARKED.
 * @param {{ dayPlan: object, store: object }} args
 */
export async function resolveNextMicroaction({ dayPlan, store }) {
  const active = await store.getActiveMicroaction();
  if (active) return active;

  const blocks = dayPlan?.blocks ?? [];
  const incomplete = [];
  for (const block of blocks) {
    if (!block.microactionId) continue;
    const micro = await store.getMicroaction(block.microactionId);
    if (!micro) continue;
    if (micro.status === MicroactionStatus.COMPLETED) continue;
    incomplete.push(micro);
  }
  const open = incomplete.find(
    (m) => m.status === MicroactionStatus.OPEN || m.status === MicroactionStatus.ACTIVE,
  );
  return open ?? incomplete[0] ?? null;
}
