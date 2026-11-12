import { ActionStatus, MicroactionStatus } from '../domain/statuses.js';

/**
 * Supabase Store adapter — durable life data for Agent Service (ADR-0006).
 * Callers speak glossary nouns; this module owns PostgREST table dialect.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient | ReturnType<import('./fakeSupabaseClient.js').createFakeSupabaseClient>} client
 */
export function createSupabaseStore(client) {
  function throwIfError(error, action) {
    if (error) throw new Error(`Store ${action}: ${error.message ?? error}`);
  }

  async function getSingletonStreakRow() {
    const { data, error } = await client
      .from('agent_streak')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    throwIfError(error, 'getStreak');
    if (data) return data;
    const seed = {
      id: 1,
      count: 0,
      freeze_remaining_this_week: 1,
      freeze_week_key: null,
    };
    const { error: upsertError } = await client.from('agent_streak').upsert(seed, { onConflict: 'id' });
    throwIfError(upsertError, 'seedStreak');
    return seed;
  }

  function isoWeekKey(dateKey) {
    const date = new Date(`${dateKey}T12:00:00.000Z`);
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  async function ensureFreezeWeek(dateKey) {
    const row = await getSingletonStreakRow();
    const weekKey = isoWeekKey(dateKey);
    if (row.freeze_week_key !== weekKey) {
      const next = {
        ...row,
        freeze_week_key: weekKey,
        freeze_remaining_this_week: 1,
      };
      const { error } = await client.from('agent_streak').upsert(next, { onConflict: 'id' });
      throwIfError(error, 'ensureFreezeWeek');
      return next;
    }
    return row;
  }

  async function getGoalsTree() {
    const { data, error } = await client.from('agent_goals').select('*').eq('id', 'tree').maybeSingle();
    throwIfError(error, 'getGoals');
    return data?.payload ? structuredClone(data.payload) : [];
  }

  async function saveGoalsTree(goals) {
    const { error } = await client.from('agent_goals').upsert(
      { id: 'tree', payload: goals },
      { onConflict: 'id' },
    );
    throwIfError(error, 'saveGoals');
  }

  return {
    async getDayPlan(dateKey) {
      const { data, error } = await client
        .from('agent_day_plans')
        .select('*')
        .eq('date_key', dateKey)
        .maybeSingle();
      throwIfError(error, 'getDayPlan');
      if (!data) return null;
      return { date: data.date_key, status: data.status, blocks: data.blocks ?? [] };
    },

    async saveDayPlan(plan) {
      const { error } = await client.from('agent_day_plans').upsert(
        {
          date_key: plan.date,
          status: plan.status,
          blocks: plan.blocks ?? [],
        },
        { onConflict: 'date_key' },
      );
      throwIfError(error, 'saveDayPlan');
    },

    async appendDayPlanChange(entry) {
      const { error } = await client.from('agent_day_plan_changes').insert({
        date_key: entry.date,
        type: entry.type,
        at: entry.at,
        blocks: entry.blocks ?? [],
      });
      throwIfError(error, 'appendDayPlanChange');
    },

    async listDayPlanChanges(dateKey) {
      const { data, error } = await client
        .from('agent_day_plan_changes')
        .select('*')
        .eq('date_key', dateKey)
        .order('at', { ascending: true });
      throwIfError(error, 'listDayPlanChanges');
      return (data ?? []).map((row) => ({
        date: row.date_key,
        type: row.type,
        at: row.at,
        blocks: row.blocks ?? [],
      }));
    },

    async getEmailDigest(dateKey) {
      const { data, error } = await client
        .from('agent_email_digest_items')
        .select('*')
        .eq('date_key', dateKey);
      throwIfError(error, 'getEmailDigest');
      return (data ?? []).map((row) => ({ ...row.payload, messageId: row.message_id }));
    },

    async upsertEmailDigestItem(dateKey, item) {
      const { error } = await client.from('agent_email_digest_items').upsert(
        {
          date_key: dateKey,
          message_id: item.messageId,
          payload: item,
        },
        { onConflict: 'date_key,message_id' },
      );
      throwIfError(error, 'upsertEmailDigestItem');
    },

    async getDailyPoints(dateKey) {
      const { data, error } = await client
        .from('agent_daily_points')
        .select('*')
        .eq('date_key', dateKey)
        .maybeSingle();
      throwIfError(error, 'getDailyPoints');
      return data?.points ?? 0;
    },

    async addDailyPoints(dateKey, amount) {
      const current = await this.getDailyPoints(dateKey);
      const next = current + amount;
      const { error } = await client
        .from('agent_daily_points')
        .upsert({ date_key: dateKey, points: next }, { onConflict: 'date_key' });
      throwIfError(error, 'addDailyPoints');
      return next;
    },

    async getDailyPointTarget() {
      return 100;
    },

    async getStreak() {
      const row = await getSingletonStreakRow();
      return {
        count: row.count,
        freezeRemainingThisWeek: row.freeze_remaining_this_week,
      };
    },

    async recordStreakTargetMet(dateKey) {
      await ensureFreezeWeek(dateKey);
      const { data: day, error: dayError } = await client
        .from('agent_streak_days')
        .select('*')
        .eq('date_key', dateKey)
        .maybeSingle();
      throwIfError(dayError, 'recordStreakTargetMet.readDay');
      if (day?.met) return this.getStreak();

      const { error: dayWrite } = await client.from('agent_streak_days').upsert(
        { date_key: dateKey, met: true, resolved: true },
        { onConflict: 'date_key' },
      );
      throwIfError(dayWrite, 'recordStreakTargetMet.writeDay');

      const row = await getSingletonStreakRow();
      const { error } = await client
        .from('agent_streak')
        .upsert({ ...row, count: row.count + 1 }, { onConflict: 'id' });
      throwIfError(error, 'recordStreakTargetMet.bump');
      return this.getStreak();
    },

    async recordStreakMiss(dateKey) {
      const row = await ensureFreezeWeek(dateKey);
      const { data: day, error: dayError } = await client
        .from('agent_streak_days')
        .select('*')
        .eq('date_key', dateKey)
        .maybeSingle();
      throwIfError(dayError, 'recordStreakMiss.readDay');
      if (day?.resolved || day?.met) return this.getStreak();

      const { error: dayWrite } = await client.from('agent_streak_days').upsert(
        { date_key: dateKey, met: false, resolved: true },
        { onConflict: 'date_key' },
      );
      throwIfError(dayWrite, 'recordStreakMiss.writeDay');

      let next = { ...row };
      if (next.freeze_remaining_this_week > 0) {
        next = { ...next, freeze_remaining_this_week: next.freeze_remaining_this_week - 1 };
      } else {
        next = { ...next, count: 0 };
      }
      const { error } = await client.from('agent_streak').upsert(next, { onConflict: 'id' });
      throwIfError(error, 'recordStreakMiss.update');
      return this.getStreak();
    },

    async listAgentActivity() {
      const { data, error } = await client
        .from('agent_activity')
        .select('*')
        .order('at', { ascending: true });
      throwIfError(error, 'listAgentActivity');
      return (data ?? []).map((row) => ({ type: row.type, summary: row.summary, at: row.at }));
    },

    async appendAgentActivity(entry) {
      const { error } = await client.from('agent_activity').insert({
        type: entry.type,
        summary: entry.summary,
        at: entry.at ?? new Date().toISOString(),
      });
      throwIfError(error, 'appendAgentActivity');
    },

    async getHabitCheckIns(dateKey) {
      const { data, error } = await client
        .from('agent_habit_checkins')
        .select('*')
        .eq('date_key', dateKey);
      throwIfError(error, 'getHabitCheckIns');
      return (data ?? []).map((row) => ({
        habitId: row.habit_id,
        label: row.label,
        at: row.at,
      }));
    },

    async saveHabitCheckIn(dateKey, checkIn) {
      const existing = await this.getHabitCheckIns(dateKey);
      if (existing.some((c) => c.habitId === checkIn.habitId)) return existing;
      const { error } = await client.from('agent_habit_checkins').insert({
        date_key: dateKey,
        habit_id: checkIn.habitId,
        label: checkIn.label,
        at: checkIn.at,
      });
      throwIfError(error, 'saveHabitCheckIn');
      return this.getHabitCheckIns(dateKey);
    },

    async upsertCalendarEvent(event) {
      const { error } = await client.from('agent_calendar_events').upsert(
        {
          external_id: event.externalId,
          title: event.title,
          start_at: event.startAt,
          end_at: event.endAt,
        },
        { onConflict: 'external_id' },
      );
      throwIfError(error, 'upsertCalendarEvent');
    },

    async listCalendarEvents() {
      const { data, error } = await client.from('agent_calendar_events').select('*');
      throwIfError(error, 'listCalendarEvents');
      return (data ?? []).map((row) => ({
        externalId: row.external_id,
        title: row.title,
        startAt: row.start_at,
        endAt: row.end_at,
      }));
    },

    async listSenderAllowlist() {
      const { data, error } = await client
        .from('agent_sender_allowlist')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      throwIfError(error, 'listSenderAllowlist');
      return data?.entries ? structuredClone(data.entries) : [];
    },

    async setSenderAllowlist(entries) {
      const { error } = await client.from('agent_sender_allowlist').upsert(
        { id: 'default', entries },
        { onConflict: 'id' },
      );
      throwIfError(error, 'setSenderAllowlist');
    },

    async seedGoals(goals) {
      await saveGoalsTree(structuredClone(goals));
    },

    async listOpenMicroactions() {
      const goals = await getGoalsTree();
      const open = [];
      for (const goal of goals) {
        for (const action of goal.actions || []) {
          if (action.status !== ActionStatus.ACTIVE) continue;
          for (const micro of action.microactions || []) {
            if (micro.status === MicroactionStatus.OPEN) {
              open.push({ ...micro, actionId: action.id, goalId: goal.id });
            }
          }
        }
      }
      return open;
    },

    async listActiveActions() {
      const goals = await getGoalsTree();
      const active = [];
      for (const goal of goals) {
        for (const action of goal.actions || []) {
          if (action.status === ActionStatus.ACTIVE) active.push(action);
        }
      }
      return active;
    },

    async completeMicroaction(microactionId) {
      const goals = await getGoalsTree();
      for (const goal of goals) {
        for (const action of goal.actions || []) {
          for (const micro of action.microactions || []) {
            if (micro.id === microactionId) {
              if (micro.status === MicroactionStatus.COMPLETED) {
                return { alreadyComplete: true, micro };
              }
              micro.status = MicroactionStatus.COMPLETED;
              await saveGoalsTree(goals);
              return { alreadyComplete: false, micro };
            }
          }
        }
      }
      throw new Error(`Microaction not found: ${microactionId}`);
    },

    async completeAction(actionId) {
      const goals = await getGoalsTree();
      for (const goal of goals) {
        for (const action of goal.actions || []) {
          if (action.id === actionId) {
            if (action.status === ActionStatus.COMPLETED) {
              return { alreadyComplete: true, action };
            }
            action.status = ActionStatus.COMPLETED;
            await saveGoalsTree(goals);
            return { alreadyComplete: false, action };
          }
        }
      }
      throw new Error(`Action not found: ${actionId}`);
    },
  };
}
