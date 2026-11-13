import { config } from 'dotenv';

/** Load Agent Service env from `.env.agent` then `.env` (tokens stay off the Vite client). */
export function loadAgentEnv() {
  config({ path: '.env.agent' });
  config();
}
