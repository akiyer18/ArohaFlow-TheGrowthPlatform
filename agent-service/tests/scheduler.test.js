import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeGmail } from '../src/adapters/fakeGmail.js';
import { createFakeLlm } from '../src/adapters/fakeLlm.js';
import { createFakeCalendarRead } from '../src/adapters/fakeCalendarRead.js';
import { ActionStatus, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

function buildPorts(clockInstant) {
  const clock = createFixedClock(new Date(clockInstant));
  const store = createMemoryStore();
  const gmail = createFakeGmail([
    {
      id: 'm1',
      from: 'tutor@uni.ac.uk',
      subject: 'Seminar tomorrow',
      snippet: 'Please bring your notes',
      listUnsubscribe: false,
    },
  ]);
  const llm = createFakeLlm({
    rank() {
      return [];
    },
  });
  const calendarRead = createFakeCalendarRead([
    {
      id: 'evt-1',
      title: 'Standup',
      startAt: '2026-11-12T11:00:00.000Z',
      endAt: '2026-11-12T11:30:00.000Z',
    },
  ]);
  return { clock, store, gmail, llm, calendarRead };
}

describe('scheduled cadence (facade)', () => {
  it('morning run syncs calendar, builds digest, proposes today, and logs Agent Activity', async () => {
    const ports = buildPorts('2026-11-12T08:00:00.000Z');
    await ports.store.setSenderAllowlist([{ type: 'email', value: 'tutor@uni.ac.uk' }]);
    await ports.store.seedGoals([
      {
        id: 'g1',
        actions: [
          {
            id: 'a1',
            status: ActionStatus.ACTIVE,
            microactions: [{ id: 'ma1', title: 'Wire scheduler', status: MicroactionStatus.OPEN }],
          },
        ],
      },
    ]);

    const agent = createAgentService(ports);
    const result = await agent.runMorningCadence();

    expect(result.date).toBe('2026-11-12');
    expect(result.dayPlan.status).toBe(DayPlanStatus.PROPOSED);
    expect(result.dayPlan.blocks.some((b) => b.microactionId === 'ma1')).toBe(true);

    const today = await agent.listToday();
    expect(today.emailDigest.map((i) => i.messageId)).toEqual(['m1']);
    expect(today.agentActivity.some((a) => a.type === 'sync_calendar')).toBe(true);
    expect(today.agentActivity.some((a) => a.type === 'build_email_digest')).toBe(true);
    expect(today.agentActivity.some((a) => a.type === 'propose_day_plan')).toBe(true);
    expect(today.agentActivity.some((a) => a.type === 'scheduled_run' && /morning/i.test(a.summary))).toBe(
      true,
    );
  });

  it('evening run refreshes digest/calendar, proposes tomorrow, and does not lock', async () => {
    const ports = buildPorts('2026-11-11T17:30:00.000Z');
    await ports.store.setSenderAllowlist([{ type: 'email', value: 'tutor@uni.ac.uk' }]);
    await ports.store.seedGoals([
      {
        id: 'g1',
        actions: [
          {
            id: 'a1',
            status: ActionStatus.ACTIVE,
            microactions: [{ id: 'ma1', title: 'Prep tomorrow', status: MicroactionStatus.OPEN }],
          },
        ],
      },
    ]);

    const agent = createAgentService(ports);
    const result = await agent.runEveningCadence();

    expect(result.tomorrowDate).toBe('2026-11-12');
    expect(result.dayPlan.date).toBe('2026-11-12');
    expect(result.dayPlan.status).toBe(DayPlanStatus.PROPOSED);
    expect(result.dayPlan.status).not.toBe(DayPlanStatus.LOCKED);

    const today = await agent.listToday();
    expect(today.agentActivity.some((a) => a.type === 'scheduled_run' && /evening|17:30/i.test(a.summary))).toBe(
      true,
    );
    expect(today.agentActivity.some((a) => a.type === 'lock_day_plan')).toBe(false);

    const tomorrowPlan = await ports.store.getDayPlan('2026-11-12');
    expect(tomorrowPlan.status).toBe(DayPlanStatus.PROPOSED);
  });
});
