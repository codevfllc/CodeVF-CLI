import chalk from 'chalk';
import { AuthManager } from '../modules/auth.js';
import { ApiClient } from '../modules/api.js';
import { handleError } from '../utils/errors.js';

export async function tasksCommand(cancelId?: string): Promise<void> {
  try {
    const authManager = new AuthManager();
    if (!authManager.isAuthenticated()) {
      console.log(chalk.red('Error: Not authenticated.'));
      console.log(chalk.yellow('Please run: codevf login\n'));
      return;
    }

    const apiClient = new ApiClient(authManager);

    // Fetch tasks directly since the API wrapper listTasks was removed
    const response = await apiClient['client'].get(`/api/cli/tasks/list`);
    const { tasks } = response.data || { tasks: [] };

    if (cancelId) {
      const target = tasks.find((t: any) => t.id === cancelId);
      if (!target) {
        console.log(chalk.red(`Task ${cancelId} not found in open tasks.`));
        return;
      }
      await apiClient.cancelTask(cancelId);
      console.log(chalk.green(`✓ Cancelled task ${cancelId}`));
      return;
    }

    if (!tasks || tasks.length === 0) {
      console.log(chalk.dim('No open tasks.'));
      return;
    }

    console.log(chalk.bold.blue('\nOpen Tasks\n'));
    tasks.forEach((task: any) => {
      console.log(
        `${chalk.white(task.id)} ${chalk.gray('-')} ${chalk.white(task.issueDescription || 'Unknown')}`
      );
      console.log(
        chalk.dim(
          `  status: ${task.status} | project: ${task.projectId} | created: ${task.createdAt || 'n/a'}`
        )
      );
    });
  } catch (error) {
    handleError(error);
  }
}
