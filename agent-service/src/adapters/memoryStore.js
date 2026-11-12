export function createMemoryStore() {
  const state = {
    dayPlans: new Map(),
    emailDigestByDate: new Map(),
    calendarEvents: new Map(),
    dailyPointsByDate: new Map(),
    streak: { count: 0, freezeRemainingThisWeek: 1 },
    agentActivity: [],
    habitCheckInsByDate: new Map(),
    senderAllowlist: [],
    goals: [],
    dayPlanChangeLog: [],
  };

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
    async getDailyPointTarget() {
      return 100;
    },
    async getStreak() {
      return { ...state.streak };
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
    async listOpenMicroactions() {
      const open = [];
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          if (action.status !== 'active') continue;
          for (const micro of action.microactions || []) {
            if (micro.status === 'open') {
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
          if (action.status === 'active') active.push(action);
        }
      }
      return active;
    },
    async completeMicroaction(microactionId) {
      for (const goal of state.goals) {
        for (const action of goal.actions || []) {
          for (const micro of action.microactions || []) {
            if (micro.id === microactionId) {
              if (micro.status === 'completed') return { alreadyComplete: true, micro };
              micro.status = 'completed';
              return { alreadyComplete: false, micro };
            }
          }
        }
      }
      throw new Error(`Microaction not found: ${microactionId}`);
    },
    /** @internal test helper */
    _state: state,
  };
}
