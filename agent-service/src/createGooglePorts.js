import { google } from 'googleapis';
import { createFakeGmail } from './adapters/fakeGmail.js';
import { createFakeCalendarRead } from './adapters/fakeCalendarRead.js';
import { createFakeCalendarWrite } from './adapters/fakeCalendarWrite.js';
import { createGmailFromGoogleClient } from './adapters/googleGmail.js';
import { createCalendarReadFromGoogleClient } from './adapters/googleCalendarRead.js';
import {
  createCalendarWriteFromGoogleClient,
  createArohaflowCalendarResolver,
} from './adapters/googleCalendarWrite.js';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

/**
 * Build an OAuth2 client from Agent Service env (tokens never go to the Vite client).
 */
export function createOAuth2ClientFromEnv(env = process.env) {
  const clientId = env.AROHAFLOW_GOOGLE_CLIENT_ID;
  const clientSecret = env.AROHAFLOW_GOOGLE_CLIENT_SECRET;
  const refreshToken = env.AROHAFLOW_GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

function defaultCreateClients(env) {
  const auth = createOAuth2ClientFromEnv(env);
  if (!auth) return null;
  return {
    gmailApi: google.gmail({ version: 'v1', auth }),
    calendarApi: google.calendar({ version: 'v3', auth }),
  };
}

/**
 * Prefer live Google ports when OAuth env is set; otherwise fakes for local/demo.
 *
 * Env:
 * - AROHAFLOW_GOOGLE_CLIENT_ID
 * - AROHAFLOW_GOOGLE_CLIENT_SECRET
 * - AROHAFLOW_GOOGLE_REFRESH_TOKEN
 * - AROHAFLOW_GOOGLE_CALENDAR_ID (optional; else calendar named "ArohaFlow")
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ createClients?: (env: object) => { gmailApi: object, calendarApi: object } | null }} [options]
 */
export function createGooglePortsFromEnv(env = process.env, options = {}) {
  const createClients = options.createClients ?? defaultCreateClients;
  const clients = createClients(env);

  if (!clients) {
    return {
      kind: 'fake',
      gmail: createFakeGmail([]),
      calendarRead: createFakeCalendarRead([]),
      calendarWrite: createFakeCalendarWrite(),
    };
  }

  const { gmailApi, calendarApi } = clients;
  const resolveCalendarId = createArohaflowCalendarResolver(calendarApi, env);

  return {
    kind: 'google',
    gmail: createGmailFromGoogleClient(gmailApi),
    calendarRead: createCalendarReadFromGoogleClient(calendarApi),
    calendarWrite: createCalendarWriteFromGoogleClient(calendarApi, { resolveCalendarId }),
  };
}
