import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import { ConfigManager } from './config.js';
import { AiTool, ToolResult } from '../types/index.js';

export interface AiRunResult {
  output: string;
  transcript: string[];
  confidence?: 'high' | 'low' | 'failed';
  suggestFallback?: boolean;
  needsMoreInfo?: boolean;
  clarificationQuestion?: string;
}

/**
 * Wrapper around the opencode SDK using the client-only mode.
 * - Uses dynamic import so the CLI still works without the SDK installed.
 * - Avoids starting a local server by using `createOpencodeClient` (caller must have a server running).
 * - Creates a session per request, sends prompt, prints response parts, and logs transcripts locally.
 */
export class AiAgent {
  private static clientCache: any | null = null;
  private static baseUrlCache: string | null = null;
  private static serverStarted = false;
  private static serverCloser: (() => Promise<void> | void) | null = null;

  private configManager: ConfigManager;

  constructor(configManager = new ConfigManager()) {
    this.configManager = configManager;
  }

  async run(
    prompt: string,
    opts?: {
      timeoutMs?: number | null;
      baseUrl?: string;
      startServer?: boolean;
      verbose?: boolean;
      signal?: AbortSignal;
      agent?: 'plan' | 'build';
      spinner?: any; // ora spinner instance
    }
  ): Promise<AiRunResult> {
    const config = this.configManager.loadConfig();
    if (!config.ai?.enabled) {
      throw new Error('Local AI is disabled. Enable it via codevf init.');
    }

    const baseUrlEnv = config.ai.sdk.baseUrlEnv || 'OPENCODE_BASE_URL';
    const baseUrl =
      opts?.baseUrl || AiAgent.baseUrlCache || process.env[baseUrlEnv] || 'http://localhost:4096';
    const verbose = opts?.verbose || process.env.CODEVF_AI_VERBOSE === '1';

    let sdkModule: any;
    try {
      sdkModule = await import('@opencode-ai/sdk');
    } catch (error) {
      throw new Error(
        'opencode SDK not found. Install it with "npm install @opencode-ai/sdk" (or yarn/pnpm) in this project.'
      );
    }

    // Prefer starting local server if available (more reliable), otherwise use client-only.
    const createOpencodeClient = (sdkModule as any).createOpencodeClient;
    const createOpencode = (sdkModule as any).createOpencode;
    if (!createOpencodeClient && !createOpencode) {
      throw new Error(
        'opencode SDK missing createOpencode/createOpencodeClient. Check SDK version.'
      );
    }

    // Check if aborted before proceeding
    if (opts?.signal?.aborted) {
      throw new Error('Aborted');
    }

    // Reuse an existing client if we already initialized one.
    if (AiAgent.clientCache) {
      if (verbose) {
        console.log(chalk.dim(`  [debug] Reusing cached client`));
      }
      return this.executeWithClient(AiAgent.clientCache, prompt, baseUrl, baseUrlEnv, config, opts);
    }

    let client: any;
    // Try starting local server first if supported and not explicitly disabled.
    if (createOpencode && opts?.startServer !== false && !AiAgent.serverStarted) {
      if (verbose) {
        console.log(chalk.dim(`  [debug] Starting OpenCode server...`));
      }
      try {
        const started = await createOpencode({
          hostname: '127.0.0.1',
          port: 4096,
          config: {
            model: config.ai.sdk.model || undefined,
          },
        });
        client = started.client;
        const serverUrl = started?.server?.url || baseUrl;
        process.env[baseUrlEnv] = serverUrl;
        AiAgent.baseUrlCache = serverUrl;
        AiAgent.serverStarted = true;
        if (started?.server?.close) {
          AiAgent.serverCloser = async () => {
            try {
              await started.server.close();
            } catch {
              // ignore
            }
          };
        }
        if (verbose) {
          console.log(chalk.green(`  [✓] OpenCode server started: ${serverUrl}`));
        }
      } catch (error: any) {
        console.log(chalk.red(`  [×] Failed to start OpenCode server: ${error?.message || error}`));
        console.log(
          chalk.yellow(`  [!] Please ensure you have the OpenCode SDK installed and configured`)
        );
        console.log(chalk.dim(`  [!] Visit https://opencode.ai for setup instructions`));
        AiAgent.serverStarted = true; // avoid repeated start attempts in this process
      }
    }

    // If no client yet, try connecting to existing server.
    if (!client && createOpencodeClient) {
      if (verbose) {
        console.log(chalk.dim(`  [debug] Attempting to connect to OpenCode at ${baseUrl}...`));
      }
      try {
        client = await createOpencodeClient({ baseUrl });
        AiAgent.baseUrlCache = baseUrl;
        if (verbose) {
          console.log(chalk.green(`  [✓] Connected to OpenCode server`));
        }
      } catch (error: any) {
        const msg = `Failed to connect to opencode server at ${baseUrl}: ${error?.message || error}`;

        if (verbose) {
          console.log(chalk.red(`  [×] ${msg}`));
        }

        // If we already tried starting a server or are not allowed to, surface the error.
        if (!createOpencode || opts?.startServer === false || AiAgent.serverStarted) {
          throw new Error(`Cannot connect to OpenCode server. Please ensure:
1. OpenCode SDK is installed: npm install @opencode-ai/sdk
2. You have signed in: Visit https://opencode.ai/auth
3. The server is accessible at ${baseUrl}

Error: ${error?.message || error}`);
        }
      }
    }

    if (!client) {
      throw new Error(
        `Failed to create OpenCode client.

Please ensure:
1. OpenCode SDK is installed: npm install @opencode-ai/sdk
2. You have authenticated at https://opencode.ai/auth
3. Your OPENCODE_API_KEY environment variable is set (if required)

Visit https://opencode.ai for setup instructions.`
      );
    }

    AiAgent.clientCache = client;
    this.setupExitCleanup();
    return this.executeWithClient(client, prompt, baseUrl, baseUrlEnv, config, opts, verbose);
  }

  /**
   * Run AI with tool calling support
   *
   * This method wraps the standard run() method to add tool calling capabilities.
   * It detects TOOL_CALL patterns in the AI's response, executes the requested tools,
   * and feeds the results back to the AI in a conversation loop.
   */
  async runWithTools(
    prompt: string,
    tools: AiTool[],
    opts?: {
      timeoutMs?: number | null;
      baseUrl?: string;
      startServer?: boolean;
      verbose?: boolean;
      signal?: AbortSignal;
      maxToolCalls?: number; // Prevent infinite loops
      agent?: 'plan' | 'build';
      spinner?: any;
    }
  ): Promise<AiRunResult> {
    const maxToolCalls = opts?.maxToolCalls || 10; // Safety limit
    let toolCallCount = 0;
    const fullTranscript: string[] = [];

    // Build system prompt with tool definitions
    const systemPrompt = this.buildSystemPromptWithTools(tools);
    let currentPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;

    // Conversation loop
    while (toolCallCount < maxToolCalls) {
      // Run AI with current prompt
      const result = await this.run(currentPrompt, opts);

      fullTranscript.push(...result.transcript);

      // Check for tool calls in the output
      const toolCall = this.detectToolCall(result.output);

      if (!toolCall) {
        // No tool call - return final result
        return {
          ...result,
          transcript: fullTranscript,
        };
      }

      // Execute the tool
      toolCallCount++;
      console.log(chalk.dim(`  [Tool ${toolCallCount}/${maxToolCalls}]`));

      const toolResult = await this.executeTool(tools, toolCall.toolName, toolCall.parameters);

      // Format tool result for AI
      const toolResultText = this.formatToolResult(toolCall, toolResult);
      fullTranscript.push(`Tool: ${toolCall.toolName}`, `Result: ${JSON.stringify(toolResult)}`);

      // Continue conversation with tool result
      currentPrompt = `${toolResultText}\n\nPlease continue your response, incorporating the tool result above.`;

      // Check if aborted
      if (opts?.signal?.aborted) {
        return {
          output: result.output,
          transcript: fullTranscript,
          confidence: 'failed',
          suggestFallback: true,
        };
      }
    }

    // Hit max tool calls limit
    console.log(chalk.yellow(`  [!] Reached maximum tool calls (${maxToolCalls}). Stopping.`));
    return {
      output:
        "I apologize, but I've reached the maximum number of tool calls for this request. Please try breaking down your request into smaller parts.",
      transcript: fullTranscript,
      confidence: 'failed',
      suggestFallback: true,
    };
  }

  /**
   * Execute a tool directly from the tools array
   */
  private async executeTool(tools: AiTool[], toolName: string, params: any): Promise<ToolResult> {
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found. Available: ${tools.map((t) => t.name).join(', ')}`,
      };
    }

    try {
      return await tool.execute(params);
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`,
      };
    }
  }

  /**
   * Build system prompt with tool definitions
   */
  private buildSystemPromptWithTools(tools: AiTool[]): string {
    const toolDescriptions = tools
      .map((tool) => {
        const params = JSON.stringify(tool.parameters, null, 2);
        return `**${tool.name}**
Description: ${tool.description}
Parameters: ${params}`;
      })
      .join('\n\n');

    const behaviorNotes: string[] = [];
    if (tools.some((tool) => tool.name === 'consultEngineer')) {
      behaviorNotes.push(
        '- `consultEngineer` is a one-shot escalation. It returns a single engineer answer (taskMode: realtime_answer), not an ongoing chat. Include the full question and all necessary context in that single call.'
      );
    }

    const behaviorSection =
      behaviorNotes.length > 0 ? `\n**Tool behavior notes:**\n${behaviorNotes.join('\n')}\n` : '';

    return `You are an AI assistant with access to the following tools:

${toolDescriptions}

${behaviorSection}
**How to use tools:**
When you need to use a tool, respond with this exact format:
TOOL_CALL: {"toolName": "name_of_tool", "parameters": {"param1": "value1", "param2": "value2"}}

After calling a tool, wait for the tool result before continuing your response.

**When to use tools:**
- Use \`consultEngineer\` when you encounter technical questions you cannot confidently answer
- Use tools when you need external information or actions beyond your knowledge
- Provide clear, specific parameters when calling tools

**Routing help:**
- If the user asks for real-time chat with a human engineer, instruct them to type /human or press Tab until human mode is active.

**Important:**
- Only call ONE tool at a time
- Wait for the tool result before proceeding
- Use the tool result to inform your final answer`;
  }

  /**
   * Detect TOOL_CALL pattern in AI output
   */
  private detectToolCall(
    output: string
  ): { toolName: string; parameters: Record<string, any>; callId: string } | null {
    // Look for TOOL_CALL: {json} pattern
    const toolCallRegex = /TOOL_CALL:\s*(\{[^}]+\})/i;
    const match = output.match(toolCallRegex);

    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[1]);
      if (!parsed.toolName) {
        console.log(chalk.yellow('  [!] Tool call missing "toolName" field'));
        return null;
      }

      return {
        toolName: parsed.toolName,
        parameters: parsed.parameters || {},
        callId: `call_${Date.now()}`,
      };
    } catch (error) {
      console.log(chalk.yellow(`  [!] Failed to parse tool call: ${error}`));
      return null;
    }
  }

  /**
   * Format tool result for AI consumption
   */
  private formatToolResult(
    toolCall: { toolName: string; parameters: Record<string, any> },
    result: ToolResult
  ): string {
    if (result.success) {
      return `TOOL_RESULT for ${toolCall.toolName}:
Success: true
Data: ${JSON.stringify(result.data, null, 2)}
${result.creditsUsed ? `Credits used: ${result.creditsUsed}` : ''}`;
    } else {
      return `TOOL_RESULT for ${toolCall.toolName}:
Success: false
Error: ${result.error}

Please try a different approach or inform the user about the limitation.`;
    }
  }

  private async executeWithClient(
    client: any,
    prompt: string,
    baseUrl: string,
    baseUrlEnv: string,
    config: any,
    opts?: {
      timeoutMs?: number | null;
      signal?: AbortSignal;
      agent?: 'plan' | 'build';
      spinner?: any;
    },
    verbose?: boolean
  ): Promise<AiRunResult> {
    // Check if aborted
    if (opts?.signal?.aborted) {
      throw new Error('Aborted');
    }
    const timeoutMs =
      typeof opts?.timeoutMs === 'number'
        ? opts.timeoutMs
        : typeof config.ai.maxRunMs === 'number'
          ? config.ai.maxRunMs
          : null;

    const args = {
      ...(config.ai.sdk.defaultArgs || {}),
      ...(config.ai.defaultArgs || {}),
      model: config.ai.sdk.model || undefined,
    };

    const runPromise = this.invoke(
      client,
      prompt,
      args,
      verbose,
      opts?.signal,
      opts?.agent,
      opts?.spinner
    );
    const result = timeoutMs ? await this.withTimeout(runPromise, timeoutMs) : await runPromise;

    if (config.ai.logTranscripts) {
      this.appendTranscript(prompt, result.transcript);
    }

    // Remember base URL for future runs in this process
    AiAgent.baseUrlCache = process.env[baseUrlEnv] || baseUrl;

    return result;
  }

  private setupExitCleanup(): void {
    if (AiAgent.serverCloser) {
      const cleanup = async () => {
        if (AiAgent.serverCloser) {
          await AiAgent.serverCloser();
          AiAgent.serverCloser = null;
        }
      };
      ['exit', 'SIGINT', 'SIGTERM'].forEach((evt) => {
        process.once(evt as NodeJS.Signals, () => {
          cleanup().finally(() => {
            if (evt !== 'exit') {
              process.exit();
            }
          });
        });
      });
    }
  }

  private async invoke(
    client: any,
    prompt: string,
    args: Record<string, any>,
    verbose?: boolean,
    signal?: AbortSignal,
    agent?: 'plan' | 'build',
    spinner?: any
  ): Promise<AiRunResult> {
    // Check if aborted
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    const transcript: string[] = [`User: ${prompt}`];
    let output = '';

    // Initialize session with agent
    let session;
    try {
      // Use session.create() and pass agent via system prompt if specified
      const sessionResponse = await client.session.create({
        body: { title: 'CodeVF AI session' },
      });
      session = sessionResponse.data || sessionResponse;

      if (verbose) {
        console.log(chalk.dim(`  [debug] Session created: ${session.id}`));
        if (agent) {
          console.log(chalk.dim(`  [debug] Using agent mode: ${agent}`));
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to initialize opencode session: ${error?.message || error}`);
    }

    // Send prompt with agent mode if specified
    let result;
    try {
      // Prepend agent mode instruction if specified
      const humanRoutingHint =
        'If the user asks for a real-time chat with a human engineer, tell them to type /human or press Tab until human mode is active.';

      let finalPrompt = `${humanRoutingHint}\n\nUser request: ${prompt}`;
      if (agent === 'plan') {
        const agentInstructions =
          'You are in PLAN mode. Focus on creating detailed plans, breaking down tasks, and explaining implementation strategies without writing code.';
        finalPrompt = `${agentInstructions}\n\n${humanRoutingHint}\n\nUser request: ${prompt}`;
      }

      // Subscribe to events for real-time streaming
      const events = await client.event.subscribe();

      // Start the prompt (don't await yet)
      const promptPromise = client.session.prompt({
        path: { id: session.id },
        body: {
          model: args.model
            ? {
                providerID: args.model.split('/')[0],
                modelID: args.model.split('/').slice(1).join('/'),
              }
            : undefined,
          parts: [{ type: 'text', text: finalPrompt }],
        },
      });

      // Process events in real-time on a single updating line
      let hasOutput = false;

      const updateSpinner = (status: string) => {
        if (hasOutput) return; // Don't update status once we have actual output

        if (spinner) {
          // Update the ora spinner text
          spinner.text = status;
        } else {
          // Fallback to manual line updating if no spinner
          process.stdout.write('\r');
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write('  ' + status);
        }
      };

      const stopSpinner = () => {
        if (spinner) {
          spinner.stop();
          // Clear the spinner line
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
        }
      };

      // Handle events and prompt completion in parallel
      const streamHandler = (async () => {
        try {
          for await (const event of events.stream) {
            // Only process events for our session
            if (event.properties?.sessionId !== session.id) {
              continue;
            }

            const eventType = event.type;
            const props = event.properties || {};

            // Debug logging for all events
            if (verbose) {
              stopSpinner();
              console.log(
                chalk.dim(
                  `  [debug] Event: ${eventType}, props: ${JSON.stringify(props).substring(0, 100)}`
                )
              );
            }

            if (eventType === 'thinking_started' || eventType === 'thinking') {
              updateSpinner(chalk.cyan('💭 Thinking...'));
            } else if (eventType === 'thinking_complete') {
              updateSpinner(chalk.green('💭 Thinking... ✓'));
            } else if (eventType === 'tool_started' || eventType === 'tool_call') {
              const toolName = props.tool || props.name || 'unknown';
              let toolStatus = chalk.yellow(`🔧 ${toolName}`);

              // Show tool args if available
              if (props.args) {
                const argsStr = JSON.stringify(props.args);
                const truncated = argsStr.length > 60 ? argsStr.substring(0, 60) + '...' : argsStr;
                toolStatus += chalk.dim(` ${truncated}`);
              }

              updateSpinner(toolStatus);
            } else if (eventType === 'tool_complete' || eventType === 'tool_result') {
              const toolName = props.tool || props.name || 'unknown';
              updateSpinner(chalk.green(`🔧 ${toolName} ✓`));
            } else if (eventType === 'text_delta' || eventType === 'content_delta') {
              // Stop spinner and start showing actual output
              if (!hasOutput) {
                stopSpinner();
                hasOutput = true;
                // Add a newline to separate from spinner line
                process.stdout.write('\n');
              }

              // Stream text as it comes
              const text = props.text || props.content || '';
              if (text) {
                output += text;
                const highlighted = this.highlightOutput(text);
                process.stdout.write(highlighted);
              }
            } else if (eventType === 'message_complete' || eventType === 'done') {
              // Session complete
              if (!hasOutput) {
                stopSpinner();
              }
              break;
            }
          }
        } catch (err) {
          // Stream ended or error - this is okay
          if (verbose) {
            stopSpinner();
            console.log(chalk.dim(`  [debug] Event stream ended: ${err}`));
          }
        }
      })();

      // Wait for both the prompt and stream to complete
      result = await Promise.race([promptPromise, streamHandler.then(() => promptPromise)]);

      // Clean up spinner if still running
      if (!hasOutput) {
        stopSpinner();
      }

      if (hasOutput && !output.endsWith('\n')) {
        console.log(); // Ensure we end with newline
      }
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';

      // Provide helpful context based on error type
      if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
        throw new Error(`Connection to OpenCode server failed. The server may have crashed or stopped.

Troubleshooting:
1. Check if the server is running: curl http://localhost:4096/health
2. Try restarting the CLI
3. Check OpenCode logs for errors
4. Ensure you're authenticated: visit https://opencode.ai/auth

Original error: ${errorMsg}`);
      } else if (
        errorMsg.includes('401') ||
        errorMsg.includes('403') ||
        errorMsg.includes('Unauthorized')
      ) {
        throw new Error(`Authentication failed with OpenCode.

Please:
1. Visit https://opencode.ai/auth to sign in
2. Ensure your API key is valid
3. Check that OPENCODE_API_KEY environment variable is set (if required)

Original error: ${errorMsg}`);
      } else {
        throw new Error(`Failed to call OpenCode prompt: ${errorMsg}`);
      }
    }

    // If we didn't get output from streaming, extract from final response
    if (!output || output.trim().length === 0) {
      const responseData = result?.data || result;
      const parts =
        responseData?.parts || responseData?.info?.parts || responseData?.body?.parts || [];

      if (verbose) {
        console.log(
          chalk.dim(
            `  [debug] Response structure: ${JSON.stringify(Object.keys(responseData || {}))}`
          )
        );
      }

      if (Array.isArray(parts) && parts.length > 0) {
        for (const part of parts as any[]) {
          if (part?.type === 'text' && typeof part.text === 'string') {
            output += part.text;
          }
        }
      }

      // Display the output with highlighting if we got it from final response
      if (output) {
        const highlighted = this.highlightOutput(output);
        console.log(highlighted);
        if (!output.endsWith('\n')) {
          console.log();
        }
      } else {
        console.log(chalk.yellow('  [!] No response from AI'));
        return { output: '', transcript, confidence: 'failed', suggestFallback: true };
      }
    }
    // else: output was already displayed via streaming

    // Analyze response quality to determine if fallback might be needed
    const confidence = this.analyzeResponseQuality(output);
    const suggestFallback = confidence === 'low' || confidence === 'failed';

    // Check if AI is asking a clarification question (for vibe mode)
    const clarificationQuestion = this.detectClarificationQuestion(output);
    const needsMoreInfo = clarificationQuestion !== null;

    transcript.push(`AI: ${output}`);
    return {
      output,
      transcript,
      confidence,
      suggestFallback,
      needsMoreInfo,
      clarificationQuestion: clarificationQuestion || undefined,
    };
  }

  private analyzeResponseQuality(output: string): 'high' | 'low' | 'failed' {
    // Check for explicit failure indicators
    const failurePatterns = [
      /i (?:can't|cannot|am unable to|don't know how to)/i,
      /(?:sorry|unfortunately).*(?:can't|cannot|unable)/i,
      /i (?:don't have|lack) (?:access|information|ability)/i,
      /(?:this is )?beyond my (?:capabilities|knowledge)/i,
      /you (?:should|need to|might want to) (?:contact|ask|consult) (?:a |an )?(?:expert|human|engineer)/i,
    ];

    for (const pattern of failurePatterns) {
      if (pattern.test(output)) {
        return 'failed';
      }
    }

    // Check for low confidence indicators
    const lowConfidencePatterns = [
      /i'm not (?:sure|certain|confident)/i,
      /(?:might|may|could possibly) (?:need|require|want)/i,
      /without more (?:information|context|details)/i,
      /i (?:suggest|recommend) consulting/i,
    ];

    for (const pattern of lowConfidencePatterns) {
      if (pattern.test(output)) {
        return 'low';
      }
    }

    // Check response length (very short responses might be low quality)
    if (output.trim().length < 50) {
      return 'low';
    }

    // Default to high confidence
    return 'high';
  }

  private detectClarificationQuestion(output: string): string | null {
    // Check if AI is asking for more information
    const questionPatterns = [
      /could you (?:provide|share|clarify|explain)/i,
      /can you (?:provide|share|tell me|clarify)/i,
      /(?:what|which|how) (?:is|are|does)/i,
      /i (?:need|would need) (?:to know|more information about)/i,
      /to (?:help|assist|provide).*, i need/i,
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(output)) {
        // Extract the question (sentences ending with ?)
        const questions = output.match(/[^.!?]*\?/g);
        if (questions && questions.length > 0) {
          return questions[questions.length - 1].trim(); // Return last question
        }
      }
    }

    return null;
  }

  private appendTranscript(prompt: string, transcript: string[]): void {
    try {
      const logsDir = this.configManager.getLogsDir();
      const filePath = path.join(logsDir, 'ai_transcripts.log');
      const now = new Date().toISOString();
      const lines = [`[${now}] prompt: ${prompt}`, ...transcript, '---', ''];
      fs.appendFileSync(filePath, lines.join('\n'), 'utf-8');
    } catch (error) {
      console.log(chalk.yellow('Warning: failed to write AI transcript locally.'));
    }
  }

  private highlightOutput(text: string): string {
    // Highlight code blocks with cyan background
    let highlighted = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const langLabel = lang ? chalk.dim(`[${lang}]`) : '';
      return chalk.bgCyan.black(`${langLabel}\n${code}\n`) + chalk.reset('```');
    });

    // Highlight inline code with cyan
    highlighted = highlighted.replace(/`([^`]+)`/g, (match, code) => {
      return chalk.cyan(code);
    });

    // Highlight file paths with blue
    highlighted = highlighted.replace(/([\/\\][\w\/\\.-]+\.\w+)/g, (match, path) => {
      return chalk.blue(path);
    });

    // Highlight important keywords
    const keywords = [
      'error',
      'warning',
      'success',
      'failed',
      'completed',
      'important',
      'note',
      'tip',
    ];
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      highlighted = highlighted.replace(regex, (match) => {
        const lower = match.toLowerCase();
        switch (lower) {
          case 'error':
          case 'failed':
            return chalk.red.bold(match);
          case 'warning':
            return chalk.yellow.bold(match);
          case 'success':
          case 'completed':
            return chalk.green.bold(match);
          case 'important':
            return chalk.magenta.bold(match);
          case 'note':
          case 'tip':
            return chalk.cyan.bold(match);
          default:
            return match;
        }
      });
    });

    // Highlight URLs with underline
    highlighted = highlighted.replace(/(https?:\/\/[^\s]+)/g, (match, url) => {
      return chalk.underline.blue(url);
    });

    // Highlight function calls with yellow
    highlighted = highlighted.replace(/\b(\w+)\(/g, (match, func) => {
      return chalk.yellow(func) + '(';
    });

    // Highlight numbers with magenta
    highlighted = highlighted.replace(/\b(\d+)\b/g, (match, num) => {
      return chalk.magenta(num);
    });

    return highlighted;
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`AI run timed out after ${ms}ms`)), ms);
    });
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeout) {
      clearTimeout(timeout);
    }
    return result;
  }
}
