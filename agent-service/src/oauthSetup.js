#!/usr/bin/env node
/**
 * One-shot OAuth setup for the Agent Service (solo personal OS).
 * Opens a local browser flow, prints AROHAFLOW_GOOGLE_* env lines.
 * Tokens stay on the Agent Service — never paste into the Vite client.
 *
 * Usage:
 *   put CLIENT_ID / CLIENT_SECRET in .env.agent
 *   npm run agent:oauth
 */
import http from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';
import { loadAgentEnv } from './loadEnv.js';
import { GOOGLE_OAUTH_SCOPES } from './createGooglePorts.js';

loadAgentEnv();

const clientId = process.env.AROHAFLOW_GOOGLE_CLIENT_ID;
const clientSecret = process.env.AROHAFLOW_GOOGLE_CLIENT_SECRET;
const redirectPort = Number(process.env.AROHAFLOW_GOOGLE_OAUTH_PORT || 53682);
const redirectUri = `http://127.0.0.1:${redirectPort}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error('Set AROHAFLOW_GOOGLE_CLIENT_ID and AROHAFLOW_GOOGLE_CLIENT_SECRET first.');
  console.error('Create an OAuth Desktop/Web client in Google Cloud Console with redirect:');
  console.error(`  ${redirectUri}`);
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: GOOGLE_OAUTH_SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${redirectPort}`);
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400);
      res.end('Missing code');
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ArohaFlow Agent OAuth complete. You can close this tab.');
    server.close();

    console.log('\nAdd these to the Agent Service environment (not the Vite client):\n');
    console.log(`AROHAFLOW_GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`AROHAFLOW_GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`AROHAFLOW_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || ''}`);
    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned. Revoke prior access and re-run with prompt=consent.');
    }
    console.log('\nOptional: AROHAFLOW_GOOGLE_CALENDAR_ID=<google-calendar-id for calendar named ArohaFlow>');
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(redirectPort, '127.0.0.1', () => {
  console.log('Open this URL to authorize Gmail read + Calendar (ArohaFlow publish):\n');
  console.log(authUrl);
  console.log(`\nWaiting on ${redirectUri} …`);
});
