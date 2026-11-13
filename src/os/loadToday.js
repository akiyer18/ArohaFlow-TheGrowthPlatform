import { TODAY_FIXTURE, TOMORROW_PLAN_FIXTURE } from './fixtures/todayFixture';
import { ANALYTICS_FIXTURE } from './fixtures/analyticsFixture';
import { agentFetch, isAgentHttpConfigured } from './agentHttp';

/**
 * Thin UI loader for the Agent Service `listToday` shape.
 * Uses localhost HTTP when VITE_AGENT_HTTP_URL is set; otherwise portfolio fixtures.
 */
export async function loadToday() {
  if (isAgentHttpConfigured()) {
    return agentFetch('/today');
  }
  return structuredClone(TODAY_FIXTURE);
}

/** Proposed tomorrow Day Plan for evening lock secondary UX. */
export async function loadTomorrowPlan() {
  if (isAgentHttpConfigured()) {
    const today = await agentFetch('/today');
    const tomorrow = nextDateKey(today.date);
    const plan = await agentFetch(`/day-plan?date=${encodeURIComponent(tomorrow)}`);
    if (!plan) {
      throw new Error(`No Day Plan for ${tomorrow}. Run evening cadence to propose tomorrow.`);
    }
    return plan;
  }
  return structuredClone(TOMORROW_PLAN_FIXTURE);
}

/**
 * Weekly Analytics: Agent Activity from live Today when bridged;
 * four measures stay fixture-backed until a Store weekly read exists.
 */
export async function loadAnalytics() {
  if (isAgentHttpConfigured()) {
    const today = await agentFetch('/today');
    const fixture = structuredClone(ANALYTICS_FIXTURE);
    return {
      ...fixture,
      agentActivity: today.agentActivity ?? [],
    };
  }
  return structuredClone(ANALYTICS_FIXTURE);
}

export async function lockTomorrowPlan(input) {
  if (!isAgentHttpConfigured()) {
    return {
      stub: true,
      message: `Locked ${input.date}${
        input.intention?.trim() ? ` · “${input.intention.trim()}”` : ''
      }${input.acknowledgeOvercommit ? ' (overcommit acknowledged)' : ''}. Facade lock_day_plan wires when the live bridge is connected.`,
    };
  }
  return agentFetch('/lock-day-plan', {
    method: 'POST',
    body: {
      date: input.date,
      confirmed: true,
      intention: input.intention ?? null,
      acknowledgeOvercommit: Boolean(input.acknowledgeOvercommit),
    },
  });
}

export async function completeMicroactionViaAgent(input) {
  return agentFetch('/complete-microaction', { method: 'POST', body: input });
}

export async function startMicroactionViaAgent(input) {
  return agentFetch('/start-microaction', { method: 'POST', body: input });
}

function nextDateKey(dateKey) {
  const ms = Date.parse(`${dateKey}T12:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}
