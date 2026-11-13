import { describe, it, expect, afterEach } from 'vitest';
import { createAgentHttpServer } from '../src/http/createAgentHttpServer.js';

function fakeFacade() {
  return {
    async listToday() {
      return { date: '2026-11-13', dayPlan: { date: '2026-11-13', status: 'locked', blocks: [] } };
    },
    async listApplications() {
      return [{ id: 'a1', company: 'Acme', roleTitle: 'FE', link: '', notes: '', status: 'applied' }];
    },
    async upsertApplication(input) {
      return { ...input };
    },
    async listGoals() {
      return [{ id: 'g1', title: 'Land a role', actions: [] }];
    },
    async upsertGoal(input) {
      return { id: input.id || 'g-new', title: input.title, actions: [] };
    },
    async upsertAction(input) {
      return { id: input.id || 'a-new', goalId: input.goalId, title: input.title, status: input.status };
    },
    async upsertMicroaction(input) {
      return {
        id: input.id || 'm-new',
        actionId: input.actionId,
        title: input.title,
        status: input.status,
      };
    },
    async getWeeklyPlanProposal() {
      return { goalId: 'g1', actions: [{ title: 'Candidate' }], committed: false };
    },
    async proposeWeeklyPlan(input) {
      return { goalId: input.goalId, actions: [{ title: 'Proposed' }], committed: false };
    },
    async editWeeklyPlan(input) {
      return { goalId: 'g1', actions: input.actions, committed: false };
    },
    async acceptWeeklyPlan() {
      return { goalId: 'g1', actions: [{ title: 'Accepted', microactions: [] }], committed: true };
    },
    async scheduleMicroaction(input) {
      return { date: input.date, status: 'proposed', blocks: [{ microactionId: input.microactionId }] };
    },
  };
}

describe('Agent HTTP (#13)', () => {
  /** @type {import('node:http').Server | null} */
  let server = null;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  });

  it('serves facade JSON on 127.0.0.1 and maps /today + /applications', async () => {
    const agent = fakeFacade();
    const started = await createAgentHttpServer({
      agent,
      host: '127.0.0.1',
      port: 0,
    });
    server = started.server;
    const { port } = started;

    const todayRes = await fetch(`http://127.0.0.1:${port}/today`);
    expect(todayRes.status).toBe(200);
    expect(await todayRes.json()).toMatchObject({ date: '2026-11-13' });

    const appsRes = await fetch(`http://127.0.0.1:${port}/applications`);
    expect(appsRes.status).toBe(200);
    expect(await appsRes.json()).toEqual([
      { id: 'a1', company: 'Acme', roleTitle: 'FE', link: '', notes: '', status: 'applied' },
    ]);

    const putRes = await fetch(`http://127.0.0.1:${port}/applications`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'a2',
        company: 'Beta',
        roleTitle: 'SWE',
        link: '',
        notes: '',
        status: 'to_apply',
      }),
    });
    expect(putRes.status).toBe(200);
    expect(await putRes.json()).toMatchObject({ id: 'a2', company: 'Beta' });
  });

  it('rejects listen hosts that are not loopback', async () => {
    await expect(
      createAgentHttpServer({
        agent: fakeFacade(),
        host: '0.0.0.0',
        port: 0,
      }),
    ).rejects.toThrow(/loopback|127\.0\.0\.1|localhost/i);
  });

  it('maps Goals authoring routes onto the facade (#33)', async () => {
    const agent = fakeFacade();
    const started = await createAgentHttpServer({
      agent,
      host: '127.0.0.1',
      port: 0,
    });
    server = started.server;
    const { port } = started;
    const base = `http://127.0.0.1:${port}`;

    const goalsRes = await fetch(`${base}/goals`);
    expect(goalsRes.status).toBe(200);
    expect(await goalsRes.json()).toEqual([{ id: 'g1', title: 'Land a role', actions: [] }]);

    const putGoal = await fetch(`${base}/goals`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ship OS' }),
    });
    expect(putGoal.status).toBe(200);
    expect(await putGoal.json()).toMatchObject({ title: 'Ship OS' });

    const putAction = await fetch(`${base}/actions`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goalId: 'g1', title: 'Author tree', status: 'active' }),
    });
    expect(putAction.status).toBe(200);
    expect(await putAction.json()).toMatchObject({ goalId: 'g1', title: 'Author tree' });

    const putMicro = await fetch(`${base}/microactions`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'a1', title: 'Add form', status: 'open' }),
    });
    expect(putMicro.status).toBe(200);
    expect(await putMicro.json()).toMatchObject({ actionId: 'a1', title: 'Add form' });
  });

  it('maps Weekly Plan routes onto the facade (#35)', async () => {
    const agent = fakeFacade();
    const started = await createAgentHttpServer({
      agent,
      host: '127.0.0.1',
      port: 0,
    });
    server = started.server;
    const { port } = started;
    const base = `http://127.0.0.1:${port}`;

    const getRes = await fetch(`${base}/weekly-plan`);
    expect(getRes.status).toBe(200);
    expect(await getRes.json()).toMatchObject({ goalId: 'g1', committed: false });

    const proposeRes = await fetch(`${base}/weekly-plan/propose`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goalId: 'g1' }),
    });
    expect(proposeRes.status).toBe(200);
    expect(await proposeRes.json()).toMatchObject({ goalId: 'g1' });

    const editRes = await fetch(`${base}/weekly-plan`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actions: [{ title: 'Edited', microactions: [{ title: 'Slice' }] }] }),
    });
    expect(editRes.status).toBe(200);
    expect(await editRes.json()).toMatchObject({ actions: [{ title: 'Edited' }] });

    const acceptRes = await fetch(`${base}/weekly-plan/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(acceptRes.status).toBe(200);
    expect(await acceptRes.json()).toMatchObject({ committed: true });

    const scheduleRes = await fetch(`${base}/schedule-microaction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ microactionId: 'ma1', date: '2026-11-16' }),
    });
    expect(scheduleRes.status).toBe(200);
    expect(await scheduleRes.json()).toMatchObject({
      date: '2026-11-16',
      status: 'proposed',
    });
  });
});
