import { ActionStatus, MicroactionStatus } from '../domain/statuses.js';

export function createMemoryStore() {
  const state = {
    dayPlans: new Map(),
    emailDigestByDate: new Map(),
    calendarEvents: new Map(),
    dailyPointsByDate: new Map(),
    completionsByDate: new Map(),
    streak: { count: 0, freezeRemainingThisWeek: 1, freezeWeekKey: null },
    streakDaysMet: new Set(),
    streakDaysResolved: new Set(),
    agentActivity: [],
    habitCheckInsByDate: new Map(),
    senderAllowlist: [],
    goals: [],
    habits: [],
    applications: [],
    weeklyPlanProposal: null,
    dayPlanChangeLog: [],
  };

  function isoWeekKey(dateKey) {
    const date = new Date(`${dateKey}T12:00:00.000Z`);
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  function ensureFreezeWeek(dateKey) {
    const weekKey = isoWeekKey(dateKey);
    if (state.streak.freezeWeekKey !== weekKey) {
      state.streak = {
        ...state.streak,
        freezeWeekKey: weekKey,
        freezeRemainingThisWeek: 1,
      };
    }
  }

  return {
    async getDayPlan(dateKey) {
      return state.dayPlans.get(dateKey) ?? null;
    },
    async saveDayPlan(plan) {
      state.dayPlans.set(plan.date, structuredClone(plan));
    },
    async appendDayPlanChange(entry) {
      state.dayPlanChangeLog.push(entry);
    },
    async listDayPlanChanges(dateKey) {
      return state.dayPlanChangeLog.filter((entry) => entry.date === dateKey).map((e) => ({ ...e }));
    },
    async getEmailDigest(dateKey) {
      return state.emailDigestByDate.get(dateKey) ?? [];
    },
    async getDailyPoints(dateKey) {
      return state.dailyPointsByDate.get(dateKey) ?? 0;
    },
    async addDailyPoints(dateKey, amount) {
      const next = (state.dailyPointsByDate.get(dateKey) ?? 0) + amount;
      state.dailyPointsByDate.set(dateKey, next);
      return next;
    },
    async listCompletions(dateKey) {
      return [...(state.completionsByDate.get(dateKey) ?? [])];
    },
    async appendCompletion(dateKey, completion) {
      const list = state.completionsByDate.get(dateKey) ?? [];
      list.push({ ...completion });
      state.completionsByDate.set(dateKey, list);
      return list;
    },
    async getDailyPointTarget() {
      return 100;
    },
    async getStreak() {
      const { count, freezeRemainingThisWeek } = state.streak;
      return { count, freezeRemainingThisWeek };
    },
    async recordStreakTargetMet(dateKey) {
      ensureFreezeWeek(dateKey);
      if (state.streakDaysMet.has(dateKey)) {
        return this.getStreak();
      }
      state.streakDaysMet.add(dateKey);
      state.streakDaysResolved.add(dateKey);
      state.streak = {
        ...state.streak,
        count: state.streak.count + 1,
      };
      return this.getStreak();
    },
    async recordStreakMiss(dateKey) {
      ensureFreezeWeek(dateKey);
      if (state.streakDaysResolved.has(dateKey) || state.streakDaysMet.has(dateKey)) {
        return this.getStreak();
      }
      state.streakDaysResolved.add(dateKey);
      if (state.streak.freezeRemainingThisWeek > 0) {
        state.streak = {
          ...state.streak,
          freezeRemainingThisWeek: state.streak.freezeRemainingThisWeek - 1,
        };
      } else {
        state.streak = {
          ...state.streak,
          count: 0,
        };
      }
      return this.getStreak();
    },
    async listAgentActivity() {
      return [...state.agentActivity];
    },
    async getHabitCheckIns(dateKey) {
      return state.habitCheckInsByDate.get(dateKey) ?? [];
    },
    async saveHabitCheckIn(dateKey, checkIn) {
      const list = state.habitCheckInsByDate.get(dateKey) ?? [];
      if (list.some((c) => c.habitId === checkIn.habitId)) return list;
      list.push(checkIn);
      state.habitCheckInsByDate.set(dateKey, list);
      return list;
    },
    async appendAgentActivity(entry) {
      state.agentActivity.push({ ...entry, at: entry.at ?? new Date().toISOString() });
    },
    async upsertEmailDigestItem(dateKey, item) {
      const list = state.emailDigestByDate.get(dateKey) ?? [];
      const idx = list.findIndex((x) => x.messageId === item.messageId);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      state.emailDigestByDate.set(dateKey, list);
    },
    async upsertCalendarEvent(event) {
      state.calendarEvents.set(event.externalId, { ...event });
    },
    async listCalendarEvents() {
      return [...state.calendarEvents.values()];
    },
    async listSenderAllowlist() {
      return [...state.senderAllowlist];
    },
    async setSenderAllowlist(entries) {
      state.senderAllowlist = [...entries];
    },
    async seedGoals(goals) {
      state.goals = structuredClone(goals);
    },
    async listGoals() {
      return structuredClone(state.goals);
    },
    async listHabits() {
      return structuredClone(state.habits);
    },
    async upsertHabit(habit) {
      const idx = state.habits.findIndex((h) => h.id === habit.id);
      if (idx >= 0) state.habits[idx] = structuredClone(habit);
      else state.habits.push(structuredClone(habit));
      return structuredClone(habit);
    },
    async listApplications() {
      return structuredClone(state.applications);
    },
    async upsertApplication(application) {
      const idx = state.applications.findIndex((a) => a.id === application.id);
      if (idx >= 0) state.applications[idx] = structuredClone(application);
      else state.applications.push(structuredClone(application));
      return structuredClone(application);
    },
    async deleteApplication(id) {
      state.applications = state.applications.filter((a) => a.id !== id);
    },
    async saveWeeklyPlanProposal(proposal) {
      state.weeklyPlanProposal = structuredClone(proposal);
    },
    async getWeeklyPlanProposal() {
      return state.weeklyPlanProposal ? structuredClone(state.weeklyPlanProposal) : null;
    },
    async findMicroaction(microactionId) {
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          for (const micro of action.microactions || []) {
            if (micro.id === microactionId) {
              return {
                micro,
                action,
                goal,
                view: { ...micro, actionId: action.id, goalId: goal.id },
              };
            }
          }
        }
      }
      return null;
    },
    async getMicroaction(microactionId) {
      const found = await this.findMicroaction(microactionId);
      return found ? found.view : null;
    },
    async getActiveMicroaction() {
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          for (const micro of action.microactions || []) {
            if (micro.status === MicroactionStatus.ACTIVE) {
              return { ...micro, actionId: action.id, goalId: goal.id };
            }
          }
        }
      }
      return null;
    },
    async setMicroactionStatus(microactionId, status, extra = {}) {
      const found = await this.findMicroaction(microactionId);
      if (!found) throw new Error(`Microaction not found: ${microactionId}`);
      found.micro.status = status;
      if (extra.parkReason !== undefined) found.micro.parkReason = extra.parkReason;
      if (extra.parkedAt !== undefined) found.micro.parkedAt = extra.parkedAt;
      if (status === MicroactionStatus.ACTIVE) {
        delete found.micro.parkReason;
        delete found.micro.parkedAt;
      }
      return { ...found.micro, actionId: found.action.id, goalId: found.goal.id };
    },
    async listOpenMicroactions() {
      const open = [];
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          if (action.status !== ActionStatus.ACTIVE) continue;
          for (const micro of action.microactions || []) {
            if (
              micro.status === MicroactionStatus.OPEN ||
              micro.status === MicroactionStatus.ACTIVE ||
              micro.status === MicroactionStatus.PARKED
            ) {
              open.push({
                ...micro,
                actionId: action.id,
                goalId: goal.id,
              });
            }
          }
        }
      }
      return open;
    },
    async listActiveActions() {
      const active = [];
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          if (action.status === ActionStatus.ACTIVE) active.push(action);
        }
      }
      return active;
    },
    async completeMicroaction(microactionId) {
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          for (const micro of action.microactions || []) {
            if (micro.id === microactionId) {
              if (micro.status === MicroactionStatus.COMPLETED) return { alreadyComplete: true, micro };
              micro.status = MicroactionStatus.COMPLETED;
              return { alreadyComplete: false, micro };
            }
          }
        }
      }
      throw new Error(`Microaction not found: ${microactionId}`);
    },
    async completeAction(actionId) {
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          if (action.id === actionId) {
            if (action.status === ActionStatus.COMPLETED) {
              return { alreadyComplete: true, action };
            }
            action.status = ActionStatus.COMPLETED;
            return { alreadyComplete: false, action };
          }
        }
      }
      throw new Error(`Action not found: ${actionId}`);
    },
    /** @internal test helper */
    _state: state,
  };
}
