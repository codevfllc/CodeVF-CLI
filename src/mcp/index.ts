#!/usr/bin/env node

/**
 * CodeVF MCP Server
 * Enables Claude Code to delegate tasks to human engineers
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';
import { logger, LogLevel } from '../lib/utils/logger.js';

/**
 * Initialize MCP Server
 */
async function main() {
  // Set log level from environment
  if (process.env.DEBUG) {
    logger.setLevel(LogLevel.DEBUG);
  }

  let runtime;
  try {
    runtime = await createMcpServer();
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }

  const { server, chatTool, tunnelTool } = runtime;

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('CodeVF MCP Server started');

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    
    // Notify engineer about disconnect before closing
    try {
      await chatTool.notifyDisconnect();
    } catch (error) {
      logger.error('Error sending disconnect notification', error);
    }
    
    await tunnelTool.closeAll();
    await server.close();
    process.exit(0);
  });
}

// Run server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
