/**
 * MCP-facing tool router — same tools as the Agent Service facade, snake_case names.
 * Scheduler and MCP both call through createAgentService; this layer only renames/dispatch.
 *
 * @param {ReturnType<import('../createAgentService.js').createAgentService>} agent
 */
export function createMcpToolRouter(agent) {
  const tools = [
    {
      name: 'sync_calendar',
      description: 'Sync Calendar Events into ArohaFlow (idempotent by external id).',
      call: () => agent.syncCalendar(),
    },
    {
      name: 'build_email_digest',
      description: 'Build the Email Digest via rules, Sender Allowlist, and LLM ranking.',
      call: () => agent.buildEmailDigest(),
    },
    {
      name: 'propose_day_plan',
      description: 'Propose a Day Plan from Fixed Blocks, Calendar Events, and open Microactions.',
      call: (args) => agent.proposeDayPlan(args ?? {}),
    },
    {
      name: 'lock_day_plan',
      description:
        'Lock a Day Plan after explicit confirmation; Calendar Publish opted-in Blocks only.',
      call: (args) => agent.lockDayPlan(args),
    },
    {
      name: 'log_habit_checkin',
      description: 'Record a Habit Check-in for today (Completion-only Daily Points).',
      call: (args) => agent.logHabitCheckIn(args),
    },
    {
      name: 'complete_microaction',
      description: 'Mark a Microaction complete and award Daily Points once.',
      call: (args) => agent.completeMicroaction(args),
    },
    {
      name: 'list_today',
      description: 'Return Today: Day Plan, digest, points, Streak, and Agent Activity.',
      call: () => agent.listToday(),
    },
    {
      name: 'edit_weekly_plan',
      description: 'Edit Weekly Plan Action/Microaction candidates before accept.',
      call: (args) => agent.editWeeklyPlan(args),
    },
    {
      name: 'accept_weekly_plan',
      description: 'Accept Weekly Plan candidates into Active Actions (does not lock Today).',
      call: (args) => agent.acceptWeeklyPlan(args ?? {}),
    },
    {
      name: 'schedule_microaction',
      description: 'Schedule an accepted Microaction onto a Day Plan without locking.',
      call: (args) => agent.scheduleMicroaction(args),
    },
  ];

  const byName = new Map(tools.map((t) => [t.name, t]));

  return {
    listTools() {
      return tools.map(({ name, description }) => ({ name, description }));
    },

    /**
     * @param {string} name
     * @param {object} [args]
     */
    async callTool(name, args = {}) {
      const tool = byName.get(name);
      if (!tool) {
        throw new Error(`Unknown MCP tool: ${name}`);
      }
      return tool.call(args);
    },
  };
}
