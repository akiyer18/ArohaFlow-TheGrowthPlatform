#!/usr/bin/env node
/**
 * stdio MCP entry for Cursor / local clients.
 * Logs must go to stderr — stdout is the JSON-RPC transport.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './createMcpServer.js';
import { createLocalAgent } from '../createLocalAgent.js';

const { agent } = createLocalAgent();
const server = createMcpServer(agent);
const transport = new StdioServerTransport();

await server.connect(transport);
console.error('ArohaFlow Agent MCP listening on stdio (local memory ports)');
