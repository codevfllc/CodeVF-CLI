/**
 * MCP server commands for stdio and HTTP modes
 */

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import chalk from 'chalk';
import * as crypto from 'crypto';
import type { AddressInfo } from 'net';
import type { IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';

import { createMcpServer } from '../mcp/server.js';
import { logger, LogLevel } from '../lib/utils/logger.js';

export interface McpHttpOptions {
  host: string;
  port: number;
}

async function attachShutdownHandlers(
  chatTool: { notifyDisconnect: () => Promise<void> },
  tunnelTool: { closeAll: () => Promise<void> },
  server: { close: () => Promise<void> },
  onShutdown?: () => Promise<void> | void
) {
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');

    try {
      await chatTool.notifyDisconnect();
    } catch (error) {
      logger.error('Error sending disconnect notification', error);
    }

    await tunnelTool.closeAll();
    if (onShutdown) {
      await onShutdown();
    }
    await server.close();
    process.exit(0);
  });
}

export async function startMcpStdio(): Promise<void> {
  if (process.env.DEBUG) {
    logger.setLevel(LogLevel.DEBUG);
  }
  const { server, chatTool, tunnelTool } = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('CodeVF MCP Server started');
  await attachShutdownHandlers(chatTool, tunnelTool, server);
}

export async function startMcpHttp(options: McpHttpOptions): Promise<void> {
  if (process.env.DEBUG) {
    logger.setLevel(LogLevel.DEBUG);
  }
  const { host, port } = options;
  const { server, chatTool, tunnelTool } = await createMcpServer();

  const sessionIdGenerator =
    typeof crypto.randomUUID === 'function'
      ? () => crypto.randomUUID()
      : () => uuidv4();

  const app = createMcpExpressApp({ host });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator,
  });

  await server.connect(transport);

  app.get('/sse', (req: IncomingMessage, res: ServerResponse) => {
    transport.handleRequest(req, res).catch((error) => {
      logger.error('SSE request error', error);
    });
  });

  app.post('/messages', (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    transport.handleRequest(req, res, req.body).catch((error) => {
      logger.error('Message request error', error);
    });
  });

  app.all('/mcp', (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
    const parsedBody = req.method === 'POST' ? req.body : undefined;
    transport.handleRequest(req, res, parsedBody).catch((error) => {
      logger.error('MCP request error', error);
    });
  });

  console.log(
    chalk.dim(
      `# Initializing CodeVF MCP Server in HTTP mode on port ${port}...`
    )
  );

  const listener = app.listen(port, host, () => {
    const address = listener.address() as AddressInfo | null;
    const resolvedPort = address?.port ?? port;
    const hostLabel = host === '0.0.0.0' ? 'localhost' : host;
    const baseUrl = `http://${hostLabel}:${resolvedPort}`;
    console.log(chalk.dim(`# HTTP server listening on port ${resolvedPort}`));
    console.log(chalk.dim(`# SSE endpoint available at ${baseUrl}/sse`));
    console.log(chalk.dim(`# Message endpoint available at ${baseUrl}/messages`));
  });

  await attachShutdownHandlers(chatTool, tunnelTool, server, () => {
    listener.close();
  });
}
