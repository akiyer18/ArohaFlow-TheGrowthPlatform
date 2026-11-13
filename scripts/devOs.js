#!/usr/bin/env node
/**
 * Daily-driver: Agent Service HTTP + Vite together (#32).
 * Usage: npm run dev:os
 */
import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['run', 'agent:start'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true }),
];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (signal) shutdown(1);
    else shutdown(code ?? 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
