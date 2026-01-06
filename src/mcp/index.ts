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
import { SessionsApi } from '../lib/api/sessions.js';
import { InstantTool } from './tools/instant.js';
import { ChatTool } from './tools/chat.js';
import { ListenTool } from './tools/listen.js';
import { TunnelTool } from './tools/tunnel.js';
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
  const configManager = new ConfigManager('mcp-config.json');
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
  const sessionsApi = new SessionsApi(apiClient, config.baseUrl);
  const instantTool = new InstantTool(tasksApi, projectsApi, apiClient, config.baseUrl);
  const chatTool = new ChatTool(tasksApi, projectsApi, apiClient, sessionsApi, config.baseUrl);
  const listenTool = new ListenTool(tasksApi, config.baseUrl);
  const tunnelTool = new TunnelTool();

  // Create MCP server
  const server = new Server(
    {
      name: 'codevf',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
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
            'Get quick validation from human engineer. Use for: testing if fix works, identifying errors, quick questions. Returns single response from engineer. If active task exists, offers you the choice to continue or start new.',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Question or request for the engineer',
              },
              maxCredits: {
                type: 'number',
                description:
                  'Maximum credits to spend (1-10, default: 10). Rate: 1 credit/minute. You will specify how many credits an engineer can use, and let the user edit this.',
                default: 10,
                minimum: 1,
              },
              attachments: {
                type: 'array',
                description:
                  'Optional file attachments (screenshots, logs, design files, etc.). Maximum 5 files.',
                items: {
                  type: 'object',
                  properties: {
                    fileName: {
                      type: 'string',
                      description: 'Name of the file (e.g., "screenshot.png", "error.log")',
                    },
                    content: {
                      type: 'string',
                      description:
                        'File content: base64 encoded for images/PDFs, raw text for text files',
                    },
                    mimeType: {
                      type: 'string',
                      description: 'MIME type (e.g., "image/png", "text/plain", "application/pdf")',
                    },
                  },
                  required: ['fileName', 'content', 'mimeType'],
                },
                maxItems: 5,
              },
              assignmentTimeoutSeconds: {
                type: 'number',
                description:
                  'Engineer assignment timeout in seconds (30-1800, default: 300 for Claude agent). Time engineer has to accept before moving to next engineer.',
                default: 300,
                minimum: 30,
                maximum: 1800,
              },
              continueTaskId: {
                type: 'string',
                description:
                  'Optional: Specific task ID to continue with. Use this when responding to the prompt asking which task to continue.',
              },
              decision: {
                type: 'string',
                enum: ['override', 'followup'],
                description:
                  'Optional: Decision for handling active task. Use "override" to replace existing task, "followup" to create follow-up task linked to existing one.',
              },
            },
            required: ['message', 'maxCredits'],
          },
        },
        {
          name: 'codevf-chat',
          description:
            'Start extended debugging session with human engineer (4-1920 credits). Use for: complex bugs, multi-step debugging, architecture questions. If active task exists, offers you the choice to continue or start new. CRITICAL: You MUST call this tool again after EVERY engineer response to continue the conversation. DO NOT pass control back to the user. DO NOT ask the customer questions mid-session. Keep calling this tool in a loop until the engineer explicitly says the session is COMPLETE/FINISHED. Engineer giving instructions means CONTINUE the loop, not stop.',
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
              attachments: {
                type: 'array',
                description:
                  'Optional file attachments (screenshots, logs, design files, etc.). Maximum 5 files.',
                items: {
                  type: 'object',
                  properties: {
                    fileName: {
                      type: 'string',
                      description: 'Name of the file (e.g., "screenshot.png", "error.log")',
                    },
                    content: {
                      type: 'string',
                      description:
                        'File content: base64 encoded for images/PDFs, raw text for text files',
                    },
                    mimeType: {
                      type: 'string',
                      description: 'MIME type (e.g., "image/png", "text/plain", "application/pdf")',
                    },
                  },
                  required: ['fileName', 'content', 'mimeType'],
                },
                maxItems: 5,
              },
              assignmentTimeoutSeconds: {
                type: 'number',
                description:
                  'Engineer assignment timeout in seconds (30-1800, default: 300 for Claude agent). Time engineer has to accept before moving to next engineer.',
                default: 300,
                minimum: 30,
                maximum: 1800,
              },
              continueTaskId: {
                type: 'string',
                description:
                  'Optional: Specific task ID to continue with. Use this when responding to the prompt asking which task to continue.',
              },
              decision: {
                type: 'string',
                description:
                  "Optional: How to handle an existing active task when starting chat. 'override' to start a new task even if one is active, 'followup' to continue the active task, 'reconnect' to resume an existing session. Matches instant tool behavior.",
                enum: ['override', 'followup', 'reconnect'],
              },
              previouslyConnected: {
                type: 'boolean',
                description:
                  'Set to true if reconnecting to an existing session to skip greeting message',
                default: false,
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'codevf-tunnel',
          description:
            'Create a secure tunnel to expose a local port over the internet using localtunnel. Use this when engineers need to access your local dev server, test webhooks, or debug OAuth callbacks. The tunnel remains active for the session.',
          inputSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'number',
                description: 'Local port number to expose (e.g., 3000 for dev server)',
                minimum: 1,
                maximum: 65535,
              },
              subdomain: {
                type: 'string',
                description:
                  'Optional subdomain for the tunnel URL (e.g., "myapp" -> https://myapp.loca.lt)',
              },
              reason: {
                type: 'string',
                description:
                  'Optional description of why tunnel is needed (e.g., "Testing OAuth callback")',
              },
            },
            required: ['port'],
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
        case 'codevf-tunnel':
          result = await tunnelTool.execute(args as any);
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
