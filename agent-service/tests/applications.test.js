import { describe, it, expect } from 'vitest';
import { createAgentService } from '../src/createAgentService.js';
import { createFixedClock } from '../src/adapters/fixedClock.js';
import { createMemoryStore } from '../src/adapters/memoryStore.js';
import { createFakeSupabaseClient } from '../src/adapters/fakeSupabaseClient.js';
import { createSupabaseStore } from '../src/adapters/supabaseStore.js';
import { createMcpToolRouter } from '../src/mcp/toolRouter.js';

const clock = createFixedClock(new Date('2026-11-24T09:00:00.000Z'));

describe('Applications tools (ADR-0012)', () => {
  it('adds, moves and closes an Application with stage events', async () => {
    const agent = createAgentService({ clock, store: createMemoryStore() });
    const app = await agent.addApplication({ company: 'Acme', role: 'Engineer', stage: 'applied', nextStep: 'Follow up', nextStepDue: '2026-11-28' });
    expect(app).toMatchObject({ stage: 'applied', appliedOn: '2026-11-24' });

    await agent.moveApplication({ id: app.id, toStage: 'interviewing' });
    await expect(agent.moveApplication({ id: app.id, toStage: 'closed' })).rejects.toThrow('reason');
    const closed = await agent.moveApplication({ id: app.id, toStage: 'closed', closedReason: 'Rejected' });
    expect(closed).toMatchObject({ stage: 'closed', closedReason: 'Rejected', nextStep: null });

    const list = await agent.listApplications();
    expect(list.stats).toMatchObject({ open: 0, movedThisWeek: 1 });
  });

  it('sets a next step and reports it as due soon', async () => {
    const agent = createAgentService({ clock, store: createMemoryStore() });
    const app = await agent.addApplication({ company: 'Globex', role: 'Backend' });
    await agent.setApplicationNextStep({ id: app.id, nextStep: 'Apply', nextStepDue: '2026-11-25' });
    const { nextSteps } = await agent.listApplications();
    expect(nextSteps).toEqual([{ id: app.id, company: 'Globex', nextStep: 'Apply', nextStepDue: '2026-11-25', state: 'soon' }]);
    await expect(agent.setApplicationNextStep({ id: 'missing', nextStep: 'x' })).rejects.toThrow('not found');
  });

  it('persists through the Supabase adapter with the owner stamped', async () => {
    const client = createFakeSupabaseClient();
    const agent = createAgentService({ clock, store: createSupabaseStore(client, { ownerUserId: 'user-1' }) });
    const app = await agent.addApplication({ company: 'Initech', role: 'Full-stack', stage: 'saved' });
    const { data: rows } = await client.from('agent_applications').select('*');
    expect(rows[0]).toMatchObject({ id: app.id, company: 'Initech', role: 'Full-stack', stage: 'saved', user_id: 'user-1' });
    const { data: events } = await client.from('agent_application_events').select('*');
    expect(events[0]).toMatchObject({ application_id: app.id, to_stage: 'saved', user_id: 'user-1' });
  });

  it('exposes the tools on the MCP router', () => {
    const names = createMcpToolRouter(createAgentService({ clock, store: createMemoryStore() }))
      .listTools()
      .map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_applications', 'add_application', 'move_application', 'set_application_next_step']));
  });
});
