import chalk from 'chalk';
import prompts from 'prompts';

/**
 * Quick engineer consultation for vibe mode
 * Engineer provides context to help AI, not take over the task
 */
export async function consultEngineer(
  aiQuestion: string,
  context: { userQuery: string; aiAttempt: string }
): Promise<{ engineerContext: string; credits: number }> {
  console.log(chalk.dim('  [→] Connecting to engineer for quick consultation...'));
  console.log(chalk.dim('  Rate: 2 credits/min (estimated 1-2 min)'));

  // TODO: Replace with actual backend call
  // For now, simulate engineer consultation
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mock engineer response (in production, this would be real engineer input)
  const mockEngineerResponse = `Based on the codebase:
- The authentication system uses JWT tokens stored in localStorage
- Login endpoint is POST /api/auth/login
- The bug is in src/auth/validateToken.js line 42 - missing expiry check
- Fix: Add "if (Date.now() > token.exp * 1000) throw new Error('expired')"`;

  console.log(chalk.green('  [✓] Engineer provided context'));
  console.log(chalk.dim('  Credits used: 2'));

  return {
    engineerContext: mockEngineerResponse,
    credits: 2,
  };
}

/**
 * Ask if user wants to use vibe mode for this request
 */
export async function promptForVibeMode(): Promise<boolean> {
  const { useVibe } = await prompts({
    type: 'confirm',
    name: 'useVibe',
    message: '  Use vibe mode? (Engineer helps AI with context)',
    initial: true,
  });

  return useVibe;
}
