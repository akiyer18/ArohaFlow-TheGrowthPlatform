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

  server.registerTool(
    'list_today',
    { description: descriptions.list_today, inputSchema: {} },
    async () => jsonResult(await router.callTool('list_today')),
  );

  return server;
}
