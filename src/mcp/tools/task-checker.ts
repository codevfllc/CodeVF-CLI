/**
 * Task checking utilities for MCP tools
 */

import { TasksApi } from '../../lib/api/tasks.js';
import { logger } from '../../lib/utils/logger.js';

export interface TaskCheckResult {
  shouldPromptUser: boolean;
  taskToResumeId?: string;
  decision?: {
    status: 'decision_required';
    agentInstruction: string;
    existingTask: {
      id: string;
      type: string;
      status: string;
      message: string;
    };
    newTask: {
      type: 'instant' | 'chat';
      content: string;
    };
    options: Array<{
      action: 'override' | 'followup' | 'reconnect';
      description: string;
    }>;
  };
}

/**
 * Check for active tasks and determine if user should be prompted
 * Returns task ID to resume if continueTaskId is provided, or prompts user if active tasks exist
 */
export async function checkForActiveTasks(
  tasksApi: TasksApi,
  projectId: string,
  continueTaskId: string | undefined,
  toolName: 'instant' | 'chat',
  newTaskContent?: string
): Promise<TaskCheckResult> {
  console.error('=== checkForActiveTasks START ===');
  console.error('projectId:', projectId);
  console.error('continueTaskId:', continueTaskId);
  console.error('toolName:', toolName);

  // If user already specified a task to continue, use that
  if (continueTaskId) {
    console.error('continueTaskId provided, returning taskToResumeId');
    return {
      shouldPromptUser: false,
      taskToResumeId: continueTaskId,
    };
  }

  // Check for active tasks
  try {
    console.error('Calling getActiveTasks...');
    const activeTasks = await tasksApi.getActiveTasks(projectId);
    console.error('activeTasks result:', JSON.stringify(activeTasks, null, 2));
    console.error('activeTasks.length:', activeTasks?.length);

    if (activeTasks && activeTasks.length > 0) {
      const mostRecentTask = activeTasks[0];
      console.error('Found active task, returning shouldPromptUser=true');

      const agentInstructionText = `Ask the user which option they prefer for handling the existing active task. Present all options clearly and wait for their choice before proceeding.\n\nTo proceed, call this tool again with continueTaskId="${mostRecentTask.taskId}" and one of these parameters:\n  - decision="reconnect" (reconnect to task #${mostRecentTask.taskId} without sending new message)\n  - decision="followup" (continue task #${mostRecentTask.taskId} with new message)\n  - decision="override" (replace task #${mostRecentTask.taskId} with new task)`;

      return {
        shouldPromptUser: true,
        decision: {
          status: 'decision_required',
          agentInstruction: agentInstructionText,
          existingTask: {
            id: mostRecentTask.taskId,
            type: mostRecentTask.taskMode || 'unknown',
            status: mostRecentTask.status,
            message: mostRecentTask.message?.substring(0, 60) || 'No message',
          },
          newTask: {
            type: toolName,
            content: newTaskContent || '',
          },
          options: [
            {
              action: 'reconnect',
              description: `Reconnect to task #${mostRecentTask.taskId} (just listen, don't send new message)`,
            },
            {
              action: 'followup',
              description: `Add as follow-up to task #${mostRecentTask.taskId} (sends your new message)`,
            },
            {
              action: 'override',
              description: `Replace task #${mostRecentTask.taskId} with new task (closes #${mostRecentTask.taskId})`,
            },
          ],
        },
      };
    }

    console.error('No active tasks found');
  } catch (error) {
    console.error('ERROR in getActiveTasks:', error);
    // Continue with normal flow if we can't check active tasks
  }

  console.error('Returning shouldPromptUser=false (no active tasks)');
  return {
    shouldPromptUser: false,
  };
}

/**
 * Get all parent tasks up to 4 levels deep
 * Returns array of parent tasks in order from immediate parent to root
 */
export async function getParentTaskChain(
  taskId: string,
  tasksApi: TasksApi,
  projectId: string
): Promise<Array<{ taskId: string; mode: string; status: string; message: string }>> {
  try {
    const result = await tasksApi.getParentTaskChain(projectId, taskId);
    return result.parentChain;
  } catch (error) {
    console.error('Error fetching parent task chain:', error);
    return [];
  }
}

/**
 * Analyze task escalation and return recommendation with reasoning
 */
export async function analyzeTaskEscalation(
  taskId: string,
  tasksApi: TasksApi,
  projectId: string,
  currentMode: 'instant' | 'chat'
): Promise<{
  shouldEscalate: boolean;
  reason: string;
  taskChain: Array<{ taskId: string; mode: string; status: string; message: string }>;
  prompt: string;
  options: Array<{ action: 'escalate' | 'keep'; description: string }>;
}> {
  try {
    const parentChain = await getParentTaskChain(taskId, tasksApi, projectId);

    // Determine if escalation is needed based on task depth and complexity
    const chainDepth = parentChain.length;
    const hasComplexHistory = chainDepth >= 2; // Multiple follow-ups indicate complexity
    const shouldEscalate = hasComplexHistory && currentMode === 'instant';

    let reason = '';
    if (shouldEscalate) {
      reason = `This task has ${chainDepth} parent task${chainDepth !== 1 ? 's' : ''} in its history, indicating a complex, multi-level debugging session. The instant mode has a 5-minute timeout and is designed for quick questions. A chat session would allow for continuous, extended collaboration with the engineer, better suited for this complexity level.`;
    } else {
      reason = `This is a straightforward ${currentMode} task${chainDepth === 0 ? ' with no parent tasks' : ' that can be handled efficiently'} within the current mode's parameters.`;
    }

    const prompt = shouldEscalate
      ? `This task appears to be part of a multi-level debugging conversation with ${chainDepth} parent task${chainDepth !== 1 ? 's' : ''}. The current instant mode (5-minute timeout) may be limiting for complex, ongoing collaboration.\n\nWould you like to escalate this to a chat session for extended, real-time collaboration with the engineer? This would provide better continuity and allow for deeper problem-solving without timeout constraints.`
      : `This task can continue as an instant query. However, if you need extended real-time collaboration, you have the option to escalate to chat mode.`;

    return {
      shouldEscalate,
      reason,
      taskChain: parentChain,
      prompt,
      options: [
        {
          action: 'escalate',
          description: 'Escalate to Chat (extended collaboration, no timeout)',
        },
        {
          action: 'keep',
          description: `Keep as ${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} (quick response within timeout)`,
        },
      ],
    };
  } catch (error) {
    console.error('Error analyzing task escalation:', error);
    return {
      shouldEscalate: false,
      reason: 'Unable to analyze task escalation',
      taskChain: [],
      prompt: 'Continue with current mode.',
      options: [
        { action: 'escalate', description: 'Escalate to Chat' },
        { action: 'keep', description: 'Keep as Instant' },
      ],
    };
  }
}
