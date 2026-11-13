import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeGmail } from '../src/adapters/fakeGmail.js';
import { createFakeLlm } from '../src/adapters/fakeLlm.js';
import { createFakeCalendarRead } from '../src/adapters/fakeCalendarRead.js';
import { createFakeCalendarWrite } from '../src/adapters/fakeCalendarWrite.js';
import { createMcpToolRouter } from '../src/mcp/toolRouter.js';
import { ActionStatus, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('MCP tool router', () => {
  it('lists the v1 facade tools and dispatches list_today / sync_calendar / propose / lock', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    await store.seedGoals([
      {
        id: 'g1',
        actions: [
          {
            id: 'a1',
            status: ActionStatus.ACTIVE,
            microactions: [
              {
                id: 'ma1',
                title: 'Ship MCP',
                status: MicroactionStatus.OPEN,
                publishToCalendar: true,
              },
            ],
          },
        ],
      },
    ]);

    const agent = createAgentService({
      clock,
      store,
      gmail: createFakeGmail([]),
      llm: createFakeLlm({ rank: () => [] }),
      calendarRead: createFakeCalendarRead([]),
      calendarWrite: createFakeCalendarWrite(),
    });
    const mcp = createMcpToolRouter(agent);

    const names = mcp.listTools().map((t) => t.name);
    expect(names).toEqual([
      'sync_calendar',
      'build_email_digest',
      'propose_day_plan',
      'lock_day_plan',
      'log_habit_checkin',
      'complete_microaction',
      'list_today',
      'edit_weekly_plan',
      'accept_weekly_plan',
      'schedule_microaction',
      'upsert_habit',
      'list_habits',
      'list_calendar_view',
    ]);

    const synced = await mcp.callTool('sync_calendar', {});
    expect(Array.isArray(synced)).toBe(true);

    const proposed = await mcp.callTool('propose_day_plan', { date: '2026-11-12' });
    expect(proposed.status).toBe(DayPlanStatus.PROPOSED);

    await expect(mcp.callTool('lock_day_plan', { date: '2026-11-12', confirmed: false })).rejects.toThrow(
      /confirm/i,
    );

    const locked = await mcp.callTool('lock_day_plan', { date: '2026-11-12', confirmed: true });
    expect(locked.status).toBe(DayPlanStatus.LOCKED);

    const today = await mcp.callTool('list_today', {});
    expect(today.date).toBe('2026-11-11');
    expect(today.agentActivity.some((a) => a.type === 'lock_day_plan')).toBe(true);
  });

  it('routes habit check-in and complete_microaction through the same facade', async () => {
    const clock = createFixedClock(new Date('2026-11-12T10:00:00.000Z'));
    const store = createMemoryStore();
    await store.seedGoals([
      {
        id: 'g1',
        actions: [
          {
            id: 'a1',
            status: ActionStatus.ACTIVE,
            microactions: [{ id: 'ma1', title: 'Done slice', status: MicroactionStatus.OPEN }],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store });
    const mcp = createMcpToolRouter(agent);

    const habit = await mcp.callTool('log_habit_checkin', { habitId: 'gym', label: 'Went to gym' });
    expect(habit.awarded).toBe(10);

    const done = await mcp.callTool('complete_microaction', { microactionId: 'ma1' });
    expect(done.awarded).toBe(20);

    const again = await mcp.callTool('complete_microaction', { microactionId: 'ma1' });
    expect(again.awarded).toBe(0);

    const today = await mcp.callTool('list_today', {});
    expect(today.dailyPoints).toBe(30);
  });
});
