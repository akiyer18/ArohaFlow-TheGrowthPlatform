import { createAgentService } from './createAgentService.js';
import { createFixedClock } from './adapters/fixedClock.js';
import { createSystemClock } from './adapters/systemClock.js';
import { createFakeGmail } from './adapters/fakeGmail.js';
import { createFakeLlm } from './adapters/fakeLlm.js';
import { createFakeCalendarRead } from './adapters/fakeCalendarRead.js';
import { createFakeCalendarWrite } from './adapters/fakeCalendarWrite.js';
import { createStoreFromEnv } from './createStore.js';

/**
 * Local/demo Agent Service. Store: Supabase when env is set, else memory.
 * Live Google OAuth adapters land in #12; Cursor MCP can exercise the facade today.
 *
 * @param {{ now?: Date, store?: object, gmailMessages?: object[], calendarEvents?: object[] }} [options]
 */
export function createLocalAgent(options = {}) {
  const clock = options.now ? createFixedClock(options.now) : createSystemClock();
  const store = options.store ?? createStoreFromEnv().store;
  const agent = createAgentService({
    clock,
    store,
    gmail: createFakeGmail(options.gmailMessages ?? []),
    llm: createFakeLlm({
      rank(candidates) {
        return candidates.map((c) => ({
          messageId: c.id,
          score: 0.5,
          reason: 'local demo rank',
        }));
      },
    }),
    calendarRead: createFakeCalendarRead(options.calendarEvents ?? []),
    calendarWrite: createFakeCalendarWrite(),
  });

  return { agent, clock, store };
}
