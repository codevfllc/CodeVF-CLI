import { AiTool, ToolResult } from '../types/index.js';
import { ApiClient } from '../modules/api.js';
import { AuthManager } from '../modules/auth.js';
import { ConfigManager } from '../modules/config.js';
import { pathToFileURL } from 'url';

/**
 * ConsultEngineer Tool
 *
 * Allows the AI agent to create realtime_answer requests to consult
 * human engineers for quick answers to specific technical questions.
 *
 * This tool enables hybrid AI+Human workflows where the AI can
 * escalate difficult questions to human experts and incorporate
 * their responses into the conversation.
 */
export const consultEngineerTool: AiTool = {
  name: 'consultEngineer',
  description:
    'Consult a human engineer for quick, single-response answers to specific technical questions. ' +
    'This is a one-shot request (not a chat), so include the full question and all necessary context. ' +
    'Use this when you need expert human insight, code review, or answers to questions ' +
    'you cannot confidently answer alone. Response typically within 2-5 minutes.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Clear, specific question for the engineer. Include context and what you need to know.',
      },
      context: {
        type: 'string',
        description: 'Relevant code snippets, error messages, or background information the engineer needs.',
      },
      urgency: {
        type: 'string',
        description: 'Priority level: "normal" or "high". High uses more credits for faster response.',
        enum: ['normal', 'high'],
      },
    },
    required: ['question', 'context'],
  },

  async execute(params: { question: string; context: string; urgency?: string }): Promise<ToolResult> {
    try {
      const authManager = new AuthManager();
      const configManager = new ConfigManager();
      const apiClient = new ApiClient(authManager);

      // Verify prerequisites
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: 'Not authenticated. Please run: codevf login',
        };
      }

      if (!configManager.isInitialized()) {
        return {
          success: false,
          error: 'Project not initialized. Please run: codevf init',
        };
      }

      const config = configManager.loadConfig();
      const urgency = params.urgency || 'normal';

      // Check if consultEngineer tool is enabled in config
      const toolConfig = config.ai?.tools?.consultEngineer;
      if (toolConfig && toolConfig.enabled === false) {
        return {
          success: false,
          error: 'ConsultEngineer tool is disabled in project configuration',
        };
      }

      // Create task description combining question and context
      const issueDescription =
        `[AI Consultation Request]\n\n` +
        `**Question:**\n${params.question}\n\n` +
        `**Context:**\n${params.context}`;

      // Determine credits based on urgency and config
      const defaultMaxCredits = urgency === 'high' ? 20 : 10;
      const maxCredits = urgency === 'high'
        ? (toolConfig?.highUrgencyCredits || defaultMaxCredits)
        : (toolConfig?.maxCreditsPerCall || defaultMaxCredits);

      console.log(`🔧 AI is consulting an engineer...`);
      console.log(`   Question: ${params.question.substring(0, 60)}${params.question.length > 60 ? '...' : ''}`);
      console.log(`   Urgency: ${urgency}`);
      console.log(`   Max credits: ${maxCredits}`);

      // Create realtime_answer task
      const { taskId, creditsRemaining, warning } = await apiClient.createTask({
        issueDescription,
        projectId: config.projectId,
        maxCredits,
        taskMode: 'realtime_answer',
        contextData: JSON.stringify({
          source: 'ai_tool_call',
          aiQuestion: params.question,
          timestamp: new Date().toISOString(),
        }),
        initiatedBy: 'ai_tool',
      });

      if (warning) {
        console.log(`   ⚠️  ${warning}`);
      }

      console.log(`   ⏳ Waiting for engineer response (Task ${taskId})...`);

      // Poll for response
      const response = await waitForEngineerResponse(apiClient, taskId);

      console.log(`   ✅ Received answer from ${response.engineerName}`);
      console.log(`   Credits used: ${response.creditsUsed}`);

      return {
        success: true,
        data: {
          answer: response.answer,
          engineerName: response.engineerName,
          creditsUsed: response.creditsUsed,
        },
        creditsUsed: response.creditsUsed,
      };
    } catch (error: any) {
      console.error(`   ❌ Failed to consult engineer: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Failed to consult engineer',
      };
    }
  },
};

function parseCliArgs(argv: string[]): {
  question: string | null;
  context: string;
  urgency?: 'normal' | 'high';
} {
  const positional: string[] = [];
  let context = '';
  let urgency: 'normal' | 'high' | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--context' || arg === '-c') {
      context = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg.startsWith('--context=')) {
      context = arg.slice('--context='.length);
      continue;
    }
    if (arg === '--urgency' || arg === '-u') {
      const next = argv[i + 1];
      if (next === 'normal' || next === 'high') {
        urgency = next;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('--urgency=')) {
      const value = arg.slice('--urgency='.length);
      if (value === 'normal' || value === 'high') {
        urgency = value;
      }
      continue;
    }
    positional.push(arg);
  }

  const question = positional[0] || null;
  if (!context) {
    context = positional[1] || 'No additional context provided.';
  }

  return { question, context, urgency };
}

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  (async () => {
    const { question, context, urgency } = parseCliArgs(process.argv.slice(2));

    if (!question) {
      console.error('Usage: node consultEngineer.ts "question" [context]');
      console.error('Options: --context "<context>" --urgency normal|high');
      process.exit(1);
    }

    const result = await consultEngineerTool.execute({
      question,
      context,
      urgency,
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })().catch((error) => {
    console.error(`Failed to consult engineer: ${error?.message || error}`);
    process.exit(1);
  });
}

/**
 * Poll for engineer response with timeout
 */
async function waitForEngineerResponse(
  apiClient: ApiClient,
  taskId: string,
  timeoutMs: number = 600000 // 10 minutes max
): Promise<{ answer: string; engineerName: string; creditsUsed: number }> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Poll task status
      const task = await apiClient.getTaskStatus(taskId);

      if (task.status === 'completed') {
        return {
          answer: task.response || 'Engineer completed the task',
          engineerName: task.engineerName || 'Engineer',
          creditsUsed: parseFloat(task.actualCreditsUsed || '0'),
        };
      }

      if (task.status === 'cancelled') {
        throw new Error('Engineer consultation was cancelled');
      }

      // Show progress every 30 seconds
      const elapsed = Date.now() - startTime;
      if (elapsed % 30000 < pollInterval) {
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        console.log(`   ⏳ Still waiting... (${minutes}m ${seconds}s elapsed)`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      // If polling fails, continue trying until timeout
      if (error.message.includes('cancelled')) {
        throw error;
      }
      // Continue polling on other errors
    }
  }

  throw new Error('Engineer consultation timed out after 10 minutes');
}
