import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createFakeSupabaseClient } from '../src/adapters/fakeSupabaseClient.js';
import { createSupabaseStore } from '../src/adapters/supabaseStore.js';
import { createStoreFromEnv } from '../src/createStore.js';
import { ActionStatus, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('Supabase Store adapter', () => {
  it('persists Day Plan, digest, points, and Agent Activity across store instances (same client)', async () => {
    const client = createFakeSupabaseClient();
    const storeA = createSupabaseStore(client);
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));

    await storeA.setSenderAllowlist([{ type: 'email', value: 'tutor@uni.ac.uk' }]);
    await storeA.seedGoals([
      {
        id: 'g1',
        actions: [
          {
            id: 'a1',
            status: ActionStatus.ACTIVE,
            microactions: [{ id: 'ma1', title: 'Persist Store', status: MicroactionStatus.OPEN }],
          },
        ],
      },
    ]);
    await storeA.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: [{ id: 'b1', title: 'Deep work' }],
    });
    await storeA.upsertEmailDigestItem('2026-11-12', {
      messageId: 'm1',
      subject: 'Seminar',
      reason: 'allowlist',
    });
    await storeA.addDailyPoints('2026-11-12', 20);
    await storeA.appendAgentActivity({
      type: 'scheduled_run',
      summary: 'Morning run',
      at: '2026-11-12T08:00:00.000Z',
    });
    await storeA.upsertCalendarEvent({
      externalId: 'evt-1',
      title: 'Standup',
      startAt: '2026-11-12T11:00:00.000Z',
      endAt: '2026-11-12T11:30:00.000Z',
    });

    const storeB = createSupabaseStore(client);
    expect(await storeB.getDayPlan('2026-11-12')).toMatchObject({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
    });
    expect(await storeB.getEmailDigest('2026-11-12')).toEqual([
      expect.objectContaining({ messageId: 'm1' }),
    ]);
    expect(await storeB.getDailyPoints('2026-11-12')).toBe(20);
    expect(await storeB.listAgentActivity()).toEqual([
      expect.objectContaining({ type: 'scheduled_run' }),
    ]);
    expect(await storeB.listCalendarEvents()).toEqual([
      expect.objectContaining({ externalId: 'evt-1' }),
    ]);
    expect(await storeB.listSenderAllowlist()).toEqual([{ type: 'email', value: 'tutor@uni.ac.uk' }]);
    expect(await storeB.listOpenMicroactions()).toEqual([
      expect.objectContaining({ id: 'ma1', actionId: 'a1' }),
    ]);

    const agent = createAgentService({ clock, store: storeB });
    const today = await agent.listToday();
    expect(today.dayPlan.status).toBe(DayPlanStatus.PROPOSED);
    expect(today.dailyPoints).toBe(20);
    expect(today.emailDigest).toHaveLength(1);
  });

  it('createStoreFromEnv uses memory unless Supabase env is set', () => {
    const mem = createStoreFromEnv({});
    expect(mem.kind).toBe('memory');
    expect(mem.store.getDayPlan).toBeTypeOf('function');

    const withUrlOnly = createStoreFromEnv({ AROHAFLOW_SUPABASE_URL: 'https://example.supabase.co' });
    expect(withUrlOnly.kind).toBe('memory');
  });

  it('persists Streak and Habit Check-in across store instances', async () => {
    const client = createFakeSupabaseClient();
    const storeA = createSupabaseStore(client);
    await storeA.recordStreakTargetMet('2026-11-12');
    await storeA.saveHabitCheckIn('2026-11-12', {
      habitId: 'gym',
      label: 'Gym',
      at: '2026-11-12T08:00:00.000Z',
    });

    const storeB = createSupabaseStore(client);
    expect(await storeB.getStreak()).toEqual({ count: 1, freezeRemainingThisWeek: 1 });
    expect(await storeB.getHabitCheckIns('2026-11-12')).toEqual([
      expect.objectContaining({ habitId: 'gym' }),
    ]);
  });

  it('keeps email digest and calendar upserts idempotent', async () => {
    const store = createSupabaseStore(createFakeSupabaseClient());
    await store.upsertEmailDigestItem('2026-11-12', { messageId: 'm1', subject: 'A', reason: 'r' });
    await store.upsertEmailDigestItem('2026-11-12', { messageId: 'm1', subject: 'B', reason: 'r2' });
    expect(await store.getEmailDigest('2026-11-12')).toHaveLength(1);
    expect((await store.getEmailDigest('2026-11-12'))[0].subject).toBe('B');

    await store.upsertCalendarEvent({
      externalId: 'e1',
      title: 'One',
      startAt: '2026-11-12T10:00:00.000Z',
      endAt: '2026-11-12T11:00:00.000Z',
    });
    await store.upsertCalendarEvent({
      externalId: 'e1',
      title: 'Two',
      startAt: '2026-11-12T10:00:00.000Z',
      endAt: '2026-11-12T11:00:00.000Z',
    });
    expect(await store.listCalendarEvents()).toHaveLength(1);
    expect((await store.listCalendarEvents())[0].title).toBe('Two');
  });
});
