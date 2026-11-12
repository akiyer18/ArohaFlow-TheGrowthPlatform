import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeCalendarWrite } from '../src/adapters/fakeCalendarWrite.js';
import { ActionStatus, BlockKind, DayPlanStatus, MicroactionStatus } from '../src/domain/statuses.js';

describe('unlock / edit Day Plan change-log', () => {
  it('unlocks, edits, re-publishes, and logs propose/accept/unlock/edit with Blocks', async () => {
    const clock = createFixedClock(new Date('2026-11-11T17:30:00.000Z'));
    const store = createMemoryStore();
    const originalBlocks = [
      {
        id: 'b1',
        kind: BlockKind.FLEXIBLE,
        purpose: 'deep-work',
        microactionId: 'ma1',
        publishToCalendar: false,
        startAt: '2026-11-12T10:00:00.000Z',
        endAt: '2026-11-12T12:00:00.000Z',
        title: 'Wire Store',
      },
    ];
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.PROPOSED,
      blocks: originalBlocks,
    });
    await store.appendDayPlanChange({
      date: '2026-11-12',
      type: 'propose',
      at: '2026-11-11T17:00:00.000Z',
      blocks: originalBlocks,
    });

    const calendarWrite = createFakeCalendarWrite();
    const agent = createAgentService({ clock, store, calendarWrite });

    await agent.lockDayPlan({ date: '2026-11-12', confirmed: true });

    await expect(
      agent.editDayPlan({
        date: '2026-11-12',
        blocks: [{ ...originalBlocks[0], title: 'Should fail while locked' }],
      }),
    ).rejects.toThrow(/unlock/i);

    const unlocked = await agent.unlockDayPlan({ date: '2026-11-12' });
    expect(unlocked.status).toBe(DayPlanStatus.PROPOSED);

    const editedBlocks = [
      {
        ...originalBlocks[0],
        title: 'Wire Store (edited)',
        publishToCalendar: true,
      },
    ];
    const edited = await agent.editDayPlan({ date: '2026-11-12', blocks: editedBlocks });
    expect(edited.status).toBe(DayPlanStatus.PROPOSED);
    expect(edited.blocks[0].title).toBe('Wire Store (edited)');

    const relocked = await agent.lockDayPlan({ date: '2026-11-12', confirmed: true });
    expect(relocked.status).toBe(DayPlanStatus.LOCKED);
    expect(calendarWrite.events).toHaveLength(1);
    expect(calendarWrite.events[0].title).toBe('Wire Store (edited)');

    const types = (await store.listDayPlanChanges('2026-11-12')).map((e) => e.type);
    expect(types).toEqual(['propose', 'accept', 'unlock', 'edit', 'accept']);
    const editEntry = (await store.listDayPlanChanges('2026-11-12')).find((e) => e.type === 'edit');
    expect(editEntry.blocks[0].title).toBe('Wire Store (edited)');
  });

  it('allows Habit Check-in and Microaction Completion while Day Plan is Locked', async () => {
    const clock = createFixedClock(new Date('2026-11-12T09:00:00.000Z'));
    const store = createMemoryStore();
    await store.saveDayPlan({
      date: '2026-11-12',
      status: DayPlanStatus.LOCKED,
      blocks: [{ id: 'b1', kind: BlockKind.FIXED, purpose: 'gym' }],
    });
    await store.seedGoals([
      {
        id: 'g1',
        title: 'Ship OS',
        actions: [
          {
            id: 'a1',
            title: 'ArohaFlow',
            status: ActionStatus.ACTIVE,
            microactions: [{ id: 'ma1', title: 'Wire Store', status: MicroactionStatus.OPEN }],
          },
        ],
      },
    ]);

    const agent = createAgentService({ clock, store });
    await agent.logHabitCheckIn({ habitId: 'gym', label: 'Gym' });
    await agent.completeMicroaction({ microactionId: 'ma1' });

    const today = await agent.listToday();
    expect(today.dayPlan.status).toBe(DayPlanStatus.LOCKED);
    expect(today.dailyPoints).toBe(30);
    expect(today.habitCheckIns).toHaveLength(1);
  });
});
