#!/usr/bin/env node
/**
 * stdio MCP entry for Cursor / local clients.
 * Logs must go to stderr — stdout is the JSON-RPC transport.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadAgentEnv } from '../loadEnv.js';
import { createMcpServer } from './createMcpServer.js';
import { createLocalAgent } from '../createLocalAgent.js';

loadAgentEnv();

const { agent, googleKind } = createLocalAgent();
const server = createMcpServer(agent);
const transport = new StdioServerTransport();

await server.connect(transport);
console.error(`ArohaFlow Agent MCP listening on stdio (google=${googleKind})`);
