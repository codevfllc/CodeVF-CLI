/**
 * Shared MCP server initialization
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

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
import type { InstantToolArgs } from './tools/instant.js';
import type { ChatToolArgs } from './tools/chat.js';
import type { ListenToolArgs } from './tools/listen.js';
import type { TunnelToolArgs } from './tools/tunnel.js';
import { logger } from '../lib/utils/logger.js';

/**
 * Shared schema for engineer expertise tag parameter
 */
const createTagIdSchema = (slaMultiplier: number, modeName: string) => ({
  type: 'number' as const,
  description:
    'Optional: Engineer expertise level that affects final cost via multiplier. Available options:\n' +
    '• 1 = Engineer (1.7x multiplier) - Expert-level engineering with deep technical knowledge. Best for: complex architecture, security-critical code, performance optimization, critical bugs.\n' +
    '• 4 = Vibe Coder (1.5x multiplier) - Experienced developer with solid problem-solving. Best for: feature implementation, standard debugging, code reviews, refactoring.\n' +
    '• 5 = General Purpose (1.0x multiplier, DEFAULT) - Standard development work. Best for: simple fixes, documentation, basic questions, general tasks.\n' +
    `Cost formula: Final Credits = Base Credits × SLA Multiplier (${slaMultiplier}x for ${modeName}) × Tag Multiplier\n` +
    `Example: 5 minutes with Engineer tag = 5 credits × ${slaMultiplier} (${modeName}) × 1.7 (engineer) = ${5 * slaMultiplier * 1.7} credits\n` +
    'If not specified, defaults to General Purpose (1.0x, no additional cost).',
  enum: [1, 4, 5],
});

export interface McpRuntime {
  server: Server;
  chatTool: ChatTool;
  tunnelTool: TunnelTool;
}

export async function createMcpServer(): Promise<McpRuntime> {
  const configManager = new ConfigManager('mcp-config.json');
  if (!configManager.exists()) {
    throw new Error('Not configured. Run: npx codevf setup');
  }

  let config;
  try {
    config = configManager.load();
  } catch (error) {
    throw new Error(`Error loading config: ${(error as Error).message}`);
  }

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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'codevf-instant',
          description:
            'Request quick validation or a single response from a human engineer. Ideal for one-off questions, error identification, testing fixes, or getting quick feedback. Returns a single engineer response (non-interactive). Cost: 1 credit per minute with 2.0x SLA multiplier. Use this when you need human validation but don\'t require back-and-forth conversation. If an active task exists, the tool will prompt you to choose whether to continue, override, or create a follow-up. Best for: "Does this fix work?", "What\'s wrong with this error?", "Can you verify this output?"',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Your question or request for the engineer. Be specific and provide context. Include relevant error messages, code snippets, or what you\'ve already tried. Good examples: "This authentication error keeps appearing after login: [error]. I\'ve checked the session config and JWT settings." Bad example: "Fix this error."',
              },
              maxCredits: {
                type: 'number',
                description:
                  'Maximum credits to allocate for this task (1-10, default: 10). Credits represent minutes of engineer time. Simple questions: 3-5 credits. Moderate complexity: 6-8 credits. Complex questions: 9-10 credits. The engineer will use only what\'s needed, but setting an appropriate maximum helps with task prioritization. Cost formula: Base Credits × 2.0 (instant SLA) × Tag Multiplier (1.0-1.7x based on tagId).',
                default: 10,
                minimum: 1,
                maximum: 10,
              },
              attachments: {
                type: 'array',
                description:
                  'Optional array of file attachments to provide context (max 5 files). Attach screenshots for UI issues, log files for errors, or design files for implementation questions. Supported: Images (PNG, JPG, GIF - base64, max 10MB), PDFs (base64, max 10MB), Text files (raw text, max 1MB). Each attachment must include fileName, content, and mimeType.',
                items: {
                  type: 'object',
                  properties: {
                    fileName: {
                      type: 'string',
                      description: 'Name of the file including extension (e.g., "screenshot.png", "error.log", "design.pdf"). Use descriptive names.',
                    },
                    content: {
                      type: 'string',
                      description:
                        'File content encoded appropriately: base64 for binary files (images, PDFs), raw text for text files (logs, config files, code). Example: Buffer.from(imageBytes).toString("base64") for images.',
                    },
                    mimeType: {
                      type: 'string',
                      description: 'MIME type identifying the file format. Common types: "image/png", "image/jpeg", "image/gif", "application/pdf", "text/plain", "text/csv", "application/json".',
                    },
                  },
                  required: ['fileName', 'content', 'mimeType'],
                },
                maxItems: 5,
              },
              assignmentTimeoutSeconds: {
                type: 'number',
                description:
                  'How long (in seconds) an engineer has to accept the task before it moves to the next available engineer (30-1800 seconds, default: 300 = 5 minutes). Higher values give more time for specialized engineers to respond. Lower values prioritize faster assignment. Recommended: 300s for standard tasks, 600s+ for tasks requiring specific expertise.',
                default: 300,
                minimum: 30,
                maximum: 1800,
              },
              tagId: createTagIdSchema(2.0, 'instant'),
              continueTaskId: {
                type: 'string',
                description:
                  'Task ID to continue from a previous task. Use this parameter when the tool returns a prompt asking which active task to continue. This maintains task context and conversation history. Leave empty for new tasks.',
              },
              decision: {
                type: 'string',
                enum: ['override', 'followup'],
                description:
                  'How to handle an existing active task (use with continueTaskId). "override": Close the existing task and start a new independent task. "followup": Create a new task linked to the existing one, maintaining the context chain. Use "override" when changing direction; use "followup" when building on previous work.',
              },
              agentIdentifier: {
                type: 'string',
                description:
                  'CRITICAL: Identify your agent/client by name (e.g., "Claude Code", "Codex", "Gemini", "Custom Agent"). This is used for analytics, tracking, and improving the service for your specific agent type. Strongly recommended to always provide this. If omitted, requests are marked as "Unknown" which limits our ability to optimize for your agent.',
              },
            },
            required: ['message', 'maxCredits'],
          },
        },
        {
          name: 'codevf-chat',
          description:
            'Start an extended real-time debugging session with a human engineer (4-1920 credits, 2 credits/minute). Use this for complex multi-step debugging, architecture discussions, or problems requiring back-and-forth collaboration. Establishes a WebSocket connection for bidirectional real-time communication. CRITICAL BEHAVIORAL REQUIREMENT: This tool creates a continuous loop - you MUST call this tool again after EVERY engineer response with your update/results. DO NOT return control to the user mid-session. DO NOT ask the customer questions during the loop. Continue calling until the engineer explicitly says "COMPLETE", "FINISHED", or "ALL DONE". If the engineer gives you instructions, that means CONTINUE the loop, not stop. Use this instead of codevf-instant when: problem requires >10 minutes, multiple investigation steps needed, engineer needs to ask clarifying questions, or architecture/design decisions require discussion.',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Your message for the engineer. On first call: detailed problem description with full context, what you\'ve tried, and relevant background. On subsequent calls: status update describing what you did in response to the engineer\'s previous instructions, results of your actions, and any new findings. Be thorough - engineers need context to help effectively. Example first message: "Users are getting random logouts. I\'ve checked: session middleware (looks correct), Redis connection (stable), JWT expiration (set to 24h). Attached error logs showing session data disappearing."',
              },
              maxCredits: {
                type: 'number',
                description:
                  'Maximum credits to allocate (4-1920, default: 240). Represents minutes of engineer time at 2 credits/minute. Typical allocations: Simple debugging: 30-60 credits (15-30 min). Standard debugging: 60-120 credits (30-60 min). Complex investigation: 120-240 credits (1-2 hours). Extended architecture discussion: 240-480 credits (2-4 hours). The engineer will use only what\'s needed. Sessions automatically end when credits run out or engineer marks as complete. Cost formula: Base Credits × 2.0 (chat SLA) × Tag Multiplier (1.0-1.7x).',
                default: 240,
                minimum: 4,
                maximum: 1920,
              },
              attachments: {
                type: 'array',
                description:
                  'Optional file attachments providing context (max 5 files). Especially useful on the initial message. Include: error logs for debugging, screenshots for UI issues, config files for setup problems, architecture diagrams for design discussions. Supported: Images (PNG, JPG, GIF - base64, max 10MB), PDFs (base64, max 10MB), Text files (raw text, max 1MB). Attachments persist throughout the session.',
                items: {
                  type: 'object',
                  properties: {
                    fileName: {
                      type: 'string',
                      description: 'Descriptive filename with extension (e.g., "session-error.log", "ui-bug-screenshot.png", "architecture-diagram.pdf").',
                    },
                    content: {
                      type: 'string',
                      description:
                        'File content: base64-encoded string for binary files (images, PDFs), raw text string for text files. For images: Buffer.from(bytes).toString("base64"). For text: read as UTF-8 string.',
                    },
                    mimeType: {
                      type: 'string',
                      description: 'Standard MIME type: "image/png", "image/jpeg", "application/pdf", "text/plain", "text/csv", "application/json", etc.',
                    },
                  },
                  required: ['fileName', 'content', 'mimeType'],
                },
                maxItems: 5,
              },
              assignmentTimeoutSeconds: {
                type: 'number',
                description:
                  'Engineer assignment timeout in seconds (30-1800, default: 300 = 5 minutes). Time window for an engineer to accept the task before it\'s offered to the next engineer. For complex/specialized tasks, consider higher values (600-900s) to allow expert engineers time to respond. For urgent tasks, use lower values (60-180s) to prioritize speed over specialization.',
                default: 300,
                minimum: 30,
                maximum: 1800,
              },
              tagId: createTagIdSchema(2.0, 'chat'),
              continueTaskId: {
                type: 'string',
                description:
                  'Task ID to continue an existing session. CRITICAL: After the first call returns a taskId, you MUST include it in all subsequent calls to maintain session continuity. This preserves chat history, context, and the WebSocket connection. Also use when the tool prompts you about an existing active task. Leave empty only on the very first message of a new session.',
              },
              decision: {
                type: 'string',
                description:
                  "How to handle an existing active task. 'reconnect': Resume existing WebSocket session without sending a new message (use when you were disconnected and want to rejoin). 'followup': Add your new message to the existing session (use when continuing conversation). 'override': Close existing session and start a completely new independent session (use when changing to a different problem). If an active task exists and you don\'t specify decision, the tool will prompt you to choose.",
                enum: ['override', 'followup', 'reconnect'],
              },
              previouslyConnected: {
                type: 'boolean',
                description:
                  'Set to true when reconnecting to an existing session to skip the automated greeting message. Use true on all calls after the first one (when you\'re passing continueTaskId). Use false or omit on the initial call to a new session. This prevents redundant "Hello, I\'m Claude" messages during the conversation loop.',
                default: false,
              },
              agentIdentifier: {
                type: 'string',
                description:
                  'CRITICAL: Your agent/client identifier (e.g., "Claude Code", "Codex", "Gemini", "Custom Agent v1.0"). Used for analytics, tracking agent-specific behavior, and service optimization. Strongly recommended to always provide. Without this, we cannot improve the experience for your specific agent type, and requests appear as "Unknown" in our systems.',
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'codevf-tunnel',
          description:
            'Create a secure, password-protected tunnel using localtunnel to expose a local development server to the internet. This allows human engineers or external services to access your local application running on localhost. The tunnel provides a public HTTPS URL that forwards traffic to your specified local port. Tunnel remains active for the entire session or until explicitly closed. Common use cases: (1) Engineer needs to access your local dev server for debugging, (2) Testing webhooks from external services (Stripe, GitHub, etc.), (3) Debugging OAuth callbacks that require public URLs, (4) Sharing local previews with engineers, (5) Testing mobile apps with local backend. IMPORTANT: Ensure your local server is running on the specified port before creating the tunnel. The tunnel URL and password will be returned for sharing with engineers.',
          inputSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'number',
                description: 'Local port number to expose (1-65535). This is the port your local development server is running on. Common examples: 3000 (React/Next.js), 8080 (Spring Boot), 5000 (Flask), 8000 (Django), 4200 (Angular). Make sure your server is actively running on this port before creating the tunnel, or the tunnel will be created but won\'t work.',
                minimum: 1,
                maximum: 65535,
              },
              subdomain: {
                type: 'string',
                description:
                  'Optional custom subdomain for the tunnel URL. If specified, creates a URL like "https://{subdomain}.loca.lt". If omitted, a random subdomain is generated. Use descriptive names for easier identification (e.g., "myapp-debug", "oauth-test", "api-staging"). Note: Popular subdomains may be taken; the tool will error if unavailable.',
              },
              reason: {
                type: 'string',
                description:
                  'Optional human-readable description of why this tunnel is needed. Useful for tracking and logging tunnel usage. Examples: "Engineer needs to debug OAuth flow", "Testing Stripe webhook callbacks", "Sharing local feature preview with engineer", "Mobile app needs to connect to local API". This helps in session tracking and understanding tunnel usage patterns.',
              },
              agentIdentifier: {
                type: 'string',
                description:
                  'CRITICAL: Your agent/client name for tracking and analytics (e.g., "Claude Code", "Codex", "Gemini"). This helps us understand which agents are using tunnels, optimize the feature for your use case, and provide better support. Strongly recommended. Without this, tunnel creation is marked as "Unknown" which limits our ability to improve the tunnel experience for your agent type.',
              },
            },
            required: ['port'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: CallToolResult;
      switch (name) {
        case 'codevf-instant':
          result = await instantTool.execute((args ?? {}) as unknown as InstantToolArgs);
          break;
        case 'codevf-chat':
          result = await chatTool.execute((args ?? {}) as unknown as ChatToolArgs);
          break;
        case 'codevf-listen':
          result = await listenTool.execute((args ?? {}) as unknown as ListenToolArgs);
          break;
        case 'codevf-tunnel':
          result = await tunnelTool.execute((args ?? {}) as unknown as TunnelToolArgs);
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

      return result;
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
      };
    }
  });

  return { server, chatTool, tunnelTool };
}
