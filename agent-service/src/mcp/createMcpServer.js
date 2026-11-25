import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createMcpToolRouter } from './toolRouter.js';

/**
 * MCP server that wraps the Agent Service tool facade (same tools as scheduler).
 * @param {ReturnType<import('../createAgentService.js').createAgentService>} agent
 */
export function createMcpServer(agent) {
  const router = createMcpToolRouter(agent);
  const descriptions = Object.fromEntries(router.listTools().map((t) => [t.name, t.description]));
  const server = new McpServer({ name: 'arohaflow-agent', version: '0.1.0' });

  const jsonResult = (value) => ({
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  });

  server.registerTool(
    'sync_calendar',
    { description: descriptions.sync_calendar, inputSchema: {} },
    async () => jsonResult(await router.callTool('sync_calendar')),
  );

  server.registerTool(
    'build_email_digest',
    { description: descriptions.build_email_digest, inputSchema: {} },
    async () => jsonResult(await router.callTool('build_email_digest')),
  );

  server.registerTool(
    'propose_day_plan',
    {
      description: descriptions.propose_day_plan,
      inputSchema: {
        date: z.string().optional().describe('YYYY-MM-DD; defaults to clock today'),
      },
    },
    async (args) => jsonResult(await router.callTool('propose_day_plan', args)),
  );

  server.registerTool(
    'lock_day_plan',
    {
      description: descriptions.lock_day_plan,
      inputSchema: {
        date: z.string().describe('YYYY-MM-DD Day Plan to lock'),
        confirmed: z.boolean().describe('Must be true; publish only after explicit confirmation'),
      },
    },
    async (args) => jsonResult(await router.callTool('lock_day_plan', args)),
  );

  server.registerTool(
    'log_habit_checkin',
    {
      description: descriptions.log_habit_checkin,
      inputSchema: {
        habitId: z.string(),
        label: z.string(),
        level: z.enum(['full', 'minimum']).optional(),
      },
    },
    async (args) => jsonResult(await router.callTool('log_habit_checkin', args)),
  );

  server.registerTool(
    'complete_microaction',
    {
      description: descriptions.complete_microaction,
      inputSchema: {
        microactionId: z.string(),
      },
    },
    async (args) => jsonResult(await router.callTool('complete_microaction', args)),
  );

  const stage = z.enum(['saved', 'applied', 'interviewing', 'offer', 'closed']);

  server.registerTool(
    'list_applications',
    { description: descriptions.list_applications, inputSchema: {} },
    async () => jsonResult(await router.callTool('list_applications')),
  );

  server.registerTool(
    'add_application',
    {
      description: descriptions.add_application,
      inputSchema: {
        company: z.string(),
        role: z.string(),
        url: z.string().optional(),
        stage: stage.optional(),
        nextStep: z.string().optional(),
        nextStepDue: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await router.callTool('add_application', args)),
  );

  server.registerTool(
    'move_application',
    {
      description: descriptions.move_application,
      inputSchema: { id: z.string(), toStage: stage, closedReason: z.string().optional() },
    },
    async (args) => jsonResult(await router.callTool('move_application', args)),
  );

  server.registerTool(
    'set_application_next_step',
    {
      description: descriptions.set_application_next_step,
      inputSchema: { id: z.string(), nextStep: z.string().optional(), nextStepDue: z.string().optional() },
    },
    async (args) => jsonResult(await router.callTool('set_application_next_step', args)),
  );

  server.registerTool(
    'list_today',
    { description: descriptions.list_today, inputSchema: {} },
    async () => jsonResult(await router.callTool('list_today')),
  );

  return server;
}
