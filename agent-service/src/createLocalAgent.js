import { createAgentService } from './createAgentService.js';
import { createFixedClock } from './adapters/fixedClock.js';
import { createSystemClock } from './adapters/systemClock.js';
import { createFakeGmail } from './adapters/fakeGmail.js';
import { createFakeLlm } from './adapters/fakeLlm.js';
import { createFakeCalendarRead } from './adapters/fakeCalendarRead.js';
import { createFakeCalendarWrite } from './adapters/fakeCalendarWrite.js';
import { createStoreFromEnv } from './createStore.js';
import { createGooglePortsFromEnv } from './createGooglePorts.js';

/**
 * Agent Service process wiring.
 * Store: Supabase when env set, else memory.
 * Google: live OAuth ports when env set, else fakes (or explicit message overrides for demos).
 *
 * @param {{
 *   now?: Date,
 *   store?: object,
 *   gmailMessages?: object[],
 *   calendarEvents?: object[],
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
    }),
    calendarRead,
    calendarWrite,
  });

  return { agent, clock, store, googleKind: google.kind };
}
