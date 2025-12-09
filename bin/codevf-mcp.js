#!/usr/bin/env node

/**
 * CodeVF MCP Server entry point
 * This starts the MCP server for Claude Code integration
 */

import('../dist/mcp/index.js').catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
