#!/usr/bin/env node

/**
 * CodeVF MCP Server
 * Enables Claude Code to delegate tasks to human engineers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { ConfigManager } from '../lib/config/manager.js';
import { TokenManager } from '../lib/auth/token-manager.js';
import { ApiClient } from '../lib/api/client.js';
import { TasksApi } from '../lib/api/tasks.js';
import { ProjectsApi } from '../lib/api/projects.js';
import { InstantTool } from './tools/instant.js';
import { ChatTool } from './tools/chat.js';
import { ListenTool } from './tools/listen.js';
import { logger, LogLevel } from '../lib/utils/logger.js';

/**
 * Initialize MCP Server
 */
async function main() {
  // Set log level from environment
  if (process.env.DEBUG) {
    logger.setLevel(LogLevel.DEBUG);
  }

  // Check if configured
  const configManager = new ConfigManager('config.json');
  if (!configManager.exists()) {
    console.error('Error: Not configured. Run: codevf setup');
    process.exit(1);
  }

  // Load configuration
  let config;
  try {
    config = configManager.load();
  } catch (error) {
    console.error('Error loading config:', (error as Error).message);
    process.exit(1);
  }

  // Initialize components
  const tokenManager = new TokenManager(configManager);
  const apiClient = new ApiClient(config.baseUrl, tokenManager);
  const defaultProjectId = config.defaults?.projectId || '1';
  const tasksApi = new TasksApi(apiClient, config.baseUrl, defaultProjectId);
  const projectsApi = new ProjectsApi(apiClient);
  const instantTool = new InstantTool(tasksApi, projectsApi, tokenManager, config.baseUrl);
  const chatTool = new ChatTool(tasksApi, config.baseUrl);
  const listenTool = new ListenTool(tasksApi, config.baseUrl);

  // Create MCP server
  const server = new Server(
    {
      name: 'codevf',
      version: '0.1.0',
    },
    {
      capabilities: {
      },
    }
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'codevf-instant',
          description:
            'Get quick validation from human engineer. Use for: testing if fix works, identifying errors, quick questions. Returns single response from engineer.',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Question or request for the engineer',
              },
              maxCredits: {
                type: 'number',
                description: 'Maximum credits to spend (1-10, default: 10). Rate: 1 credit/minute. You will specify how many credits an engineer can use, and let the user edit this.',
                default: 10,
                minimum: 1,
              },
            },
            required: ['message', 'maxCredits'],
          },
        },
        {
          name: 'codevf-chat',
          description:
            'Start extended debugging session with human engineer (4-1920 credits). Use for: complex bugs, multi-step debugging, architecture questions. Returns session URL for monitoring.',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Initial message or problem description for the engineer',
              },
              maxCredits: {
                type: 'number',
                description:
                  'Maximum credits to spend (4-1920, default: 240). Rate: 2 credits/minute',
                default: 240,
                minimum: 4,
                maximum: 1920,
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'codevf-listen',
          description:
            'Monitor active chat sessions in real-time. View status, messages, and engineer updates. Use for: tracking session progress, monitoring credits, verifying engineer responses.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description:
                  'Optional specific session ID to monitor. If omitted, lists all active sessions.',
              },
              verbose: {
                type: 'boolean',
                description:
                  'Include detailed information like credits used and engineer details (default: false)',
                default: false,
              },
            },
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;
      switch (name) {
        case 'codevf-instant':
          result = await instantTool.execute(args as any);
          break;

        case 'codevf-chat':
          result = await chatTool.execute(args as any);
          break;

        case 'codevf-listen':
          result = await listenTool.execute(args as any);
          break;

        default:
          result = {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }

      return result as any;
    } catch (error) {
      logger.error('Tool execution error', error);

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      } as any;
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('CodeVF MCP Server started');

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await server.close();
    process.exit(0);
  });
}

// Run server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
