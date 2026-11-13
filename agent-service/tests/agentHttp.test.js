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
});
