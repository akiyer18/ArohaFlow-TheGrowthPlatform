import http from 'node:http';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function assertLoopbackHost(host) {
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `Agent HTTP must bind loopback only (got host=${host}). Use 127.0.0.1 or localhost.`,
    );
  }
}

function sendJson(res, status, body, corsOrigin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Thin localhost-only HTTP surface over the Agent Service facade (#13).
 * No domain logic — routes call facade methods only.
 *
 * @param {{
 *   agent: object,
 *   host?: string,
 *   port?: number,
 *   corsOrigin?: string,
 * }} options
 */
export async function createAgentHttpServer(options) {
  const host = options.host ?? '127.0.0.1';
  assertLoopbackHost(host);
  const port = options.port ?? 8787;
  const corsOrigin = options.corsOrigin ?? 'http://localhost:5173';
  const { agent } = options;

  async function dispatch(method, pathname, searchParams, body) {
    if (method === 'GET' && pathname === '/today') {
      return agent.listToday();
    }
    if (method === 'GET' && pathname === '/day-plan') {
      const date = searchParams.get('date') || undefined;
      return agent.getDayPlan(date ? { date } : {});
    }
    if (method === 'GET' && pathname === '/calendar-view') {
      const month = searchParams.get('month') || undefined;
      return agent.listCalendarView(month ? { month } : {});
    }
    if (method === 'GET' && pathname === '/goals') {
      return agent.listGoals();
    }
    if (method === 'GET' && pathname === '/allowlist') {
      return agent.listSenderAllowlist();
    }
    if (method === 'PUT' && pathname === '/allowlist') {
      return agent.setSenderAllowlist(body);
    }
    if (method === 'GET' && pathname === '/habits') {
      return agent.listHabits();
    }
    if (method === 'PUT' && pathname === '/habits') {
      return agent.upsertHabit(body);
    }
    if (method === 'GET' && pathname === '/applications') {
      return agent.listApplications();
    }
    if (method === 'PUT' && pathname === '/applications') {
      return agent.upsertApplication(body);
    }
    const appDelete = pathname.match(/^\/applications\/([^/]+)$/);
    if (method === 'DELETE' && appDelete) {
      return agent.deleteApplication({ id: decodeURIComponent(appDelete[1]) });
    }
    if (method === 'POST' && pathname === '/lock-day-plan') {
      return agent.lockDayPlan(body);
    }
    if (method === 'POST' && pathname === '/habit-checkin') {
      return agent.logHabitCheckIn(body);
    }
    if (method === 'POST' && pathname === '/complete-microaction') {
      return agent.completeMicroaction(body);
    }
    if (method === 'POST' && pathname === '/start-microaction') {
      return agent.startMicroaction(body);
    }
    if (method === 'POST' && pathname === '/park-microaction') {
      return agent.parkMicroaction(body);
    }
    if (method === 'GET' && pathname === '/health') {
      return { ok: true };
    }
    const err = new Error(`Not found: ${method} ${pathname}`);
    err.statusCode = 404;
    throw err;
  }

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || corsOrigin;
    const allowedOrigin =
      origin === 'http://localhost:5173' ||
      origin === 'http://127.0.0.1:5173' ||
      origin === corsOrigin
        ? origin
        : corsOrigin;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${host}`);
      const body = ['PUT', 'POST', 'DELETE'].includes(req.method || '')
        ? await readJsonBody(req)
        : undefined;
      const result = await dispatch(req.method || 'GET', url.pathname, url.searchParams, body);
      sendJson(res, 200, result ?? { ok: true }, allowedOrigin);
    } catch (err) {
      const status = err.statusCode || (err.message?.includes('required') ? 400 : 500);
      sendJson(
        res,
        status,
        { error: err.message || String(err) },
        allowedOrigin,
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;

  return { server, host, port: boundPort };
}
