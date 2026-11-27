import { createAgentService } from './createAgentService.js';
import { createFixedClock } from './adapters/fixedClock.js';
import { createSystemClock } from './adapters/systemClock.js';
import { createFakeGmail } from './adapters/fakeGmail.js';
import { createFakeLlm } from './adapters/fakeLlm.js';
import { createFakeCalendarRead } from './adapters/fakeCalendarRead.js';
import { createFakeCalendarWrite } from './adapters/fakeCalendarWrite.js';
import { createStoreFromEnv, createSupabaseClientFromEnv } from './createStore.js';
import { createGooglePortsFromEnv } from './createGooglePorts.js';
import { createFakeCareerOps } from './adapters/fakeCareerOps.js';
import { createJsonLlmFromEnv } from './adapters/openAiCompatibleLlm.js';
import { createFileStartupsRepo, createStartups } from './startups/findStartups.js';
import { createSupabaseStartupsRepo } from './startups/supabaseStartups.js';
import { createHttpJson } from './startups/sources.js';
import { createHttpText } from './startups/site.js';
import {
  createFileCareerOps,
  resolveCareerOpsRoot,
} from './adapters/fileCareerOps.js';

const DEMO_DISCOVERY_LISTINGS = [
  {
    id: 'job-demo-acme',
    company: 'Acme',
    roleTitle: 'AI Engineer',
    link: 'https://jobs.acme.example/ai',
    description: 'Build evaluation pipelines for LLM products.',
    score: 4.4,
    postedAt: '2026-11-12',
    discoveredAt: '2026-11-14',
    liveness: 'open',
  },
  {
    id: 'job-demo-maybe',
    company: 'MaybeCo',
    roleTitle: 'Data Scientist',
    link: 'https://jobs.maybeco.example/ds',
    description: 'Liveness uncertain — confirm before applying.',
    score: 4.0,
    postedAt: null,
    discoveredAt: '2026-11-13',
    liveness: 'uncertain',
  },
];

function createCareerOpsPort({ env, clock, careerOps }) {
  if (careerOps) {
    return { careerOps, careerOpsRoot: null };
  }

  const root = resolveCareerOpsRoot(env);
  if (root) {
    return {
      careerOps: createFileCareerOps({ root, clock, env }),
      careerOpsRoot: root,
    };
  }

  return {
    careerOps: createFakeCareerOps({
      listings: DEMO_DISCOVERY_LISTINGS,
      suggestions: {
        'job-demo-acme': {
          listingId: 'job-demo-acme',
          sections: [
            {
              section: 'experience',
              suggestion: 'Lead with evaluation-harness ownership in recent roles.',
            },
          ],
          keywords: [
            {
              keyword: 'evaluation',
              experienceHint: 'Highlight offline eval / scoring language.',
            },
          ],
        },
      },
    }),
    careerOpsRoot: null,
  };
}

/**
 * Agent Service process wiring.
 * Store: Supabase when env set, else memory.
 * Google: live OAuth ports when env set, else fakes (or explicit message overrides for demos).
 * career-ops: injectable port; defaults to fake Discovery listings (no live ATS in v1).
 *
 * @param {{
 *   now?: Date,
 *   store?: object,
 *   gmailMessages?: object[],
 *   calendarEvents?: object[],
 *   careerOps?: object,
 *   env?: NodeJS.ProcessEnv,
 * }} [options]
 */
export function createLocalAgent(options = {}) {
  const env = options.env ?? process.env;
  const clock = options.now ? createFixedClock(options.now) : createSystemClock();
  const store = options.store ?? createStoreFromEnv(env).store;

  const google = createGooglePortsFromEnv(env);
  const gmail =
    options.gmailMessages != null ? createFakeGmail(options.gmailMessages) : google.gmail;
  const calendarRead =
    options.calendarEvents != null
      ? createFakeCalendarRead(options.calendarEvents)
      : google.calendarRead;
  const calendarWrite =
    options.calendarEvents != null ? createFakeCalendarWrite() : google.calendarWrite;

  const { careerOps, careerOpsRoot } = createCareerOpsPort({
    env,
    clock,
    careerOps: options.careerOps,
  });

  const agent = createAgentService({
    clock,
    store,
    gmail,
    llm: createFakeLlm({
      rank(candidates) {
        return candidates.map((c) => ({
          messageId: c.id,
          score: 0.5,
          reason: 'local demo rank',
        }));
      },
      proposeWeeklyPlan({ goal, wipRemaining }) {
        if (wipRemaining <= 0) return { goalId: goal.id, actions: [] };
        return {
          goalId: goal.id,
          actions: [
            {
              title: `Advance: ${goal.title}`,
              microactions: [
                { title: `Next slice for ${goal.title}` },
                { title: `Second slice for ${goal.title}` },
              ],
            },
          ],
        };
      },
    }),
    calendarRead,
    calendarWrite,
    careerOps,
    startups: options.startups ?? createStartupsPort({ env, clock, root: careerOpsRoot ?? resolveCareerOpsRoot(env) }),
  });

  return { agent, clock, store, googleKind: google.kind, careerOpsRoot };
}

/** Startups list in Supabase when the Agent Service has it (seeded once from career-data), else in career-data. */
function createStartupsPort({ env, clock, root }) {
  const client = createSupabaseClientFromEnv(env);
  const fileRepo = createFileStartupsRepo(root);
  return createStartups({
    root,
    repo: client ? createSupabaseStartupsRepo(client, { seed: root ? fileRepo : null }) : fileRepo,
    http: { ...createHttpJson(), ...createHttpText() },
    llm: createJsonLlmFromEnv(env),
    tavilyKey: env.TAVILY_KEY || env.TAVILY_API_KEY,
    clock,
  });
}
