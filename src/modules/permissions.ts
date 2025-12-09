import prompts from 'prompts';
import chalk from 'chalk';
import { shouldWarnAboutFile } from '../utils/upload.js';
import { TunnelManager } from './tunnel.js';
import { ActiveTunnel } from '../types/index.js';
import net from 'net';

export class PermissionManager {
  async requestCommandPermission(command: string, reason?: string): Promise<boolean> {
    console.log('\n' + chalk.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow('Engineer requests to run:'));
    console.log(chalk.white(`  ${command}`));
    if (reason) {
      console.log(chalk.dim(`  Reason: ${reason}`));
    }
    console.log(chalk.yellow('━'.repeat(60)));

    const response = await prompts({
      type: 'confirm',
      name: 'approved',
      message: `Allow command: "${command}"?`,
      initial: false,
    });

    return response.approved ?? false;
  }

  async requestFilePermission(filePath: string, reason?: string): Promise<boolean> {
    console.log('\n' + chalk.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow('Engineer requests file:'));
    console.log(chalk.white(`  ${filePath}`));
    if (reason) {
      console.log(chalk.dim(`  Reason: ${reason}`));
    }

    const isSensitive = shouldWarnAboutFile(filePath);
    if (isSensitive) {
      console.log(
        chalk.red.bold('  ⚠ WARNING: This file may contain sensitive information!')
      );
    }

    console.log(chalk.yellow('━'.repeat(60)));

    const response = await prompts({
      type: 'confirm',
      name: 'approved',
      message: `Allow file access: "${filePath}"?${isSensitive ? ' ⚠ SENSITIVE' : ''}`,
      initial: false,
    });

    return response.approved ?? false;
  }

  async requestTunnelPermission(port: number, reason?: string): Promise<boolean> {
    console.log('\n' + chalk.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow('Engineer requests to open a tunnel'));
    console.log(chalk.white(`  Local port: ${port}`));
    if (reason) {
      console.log(chalk.dim(`  Reason: ${reason}`));
    }
    console.log(chalk.yellow('━'.repeat(60)));

    const response = await prompts({
      type: 'confirm',
      name: 'approved',
      message: `Expose port ${port} over the internet?`,
      initial: false,
    });

    return response.approved ?? false;
  }

  /**
   * Handle tunnel request with full lifecycle management
   */
  async handleTunnelRequest(
    port: number,
    reason: string,
    taskId: string,
    tunnelManager: TunnelManager
  ): Promise<{ approved: boolean; tunnelUrl?: string; error?: string }> {
    // Display permission prompt
    console.log('\n' + chalk.yellow('┌─────────────────────────────────────────┐'));
    console.log(chalk.yellow('│ Engineer requests tunnel access:        │'));
    console.log(chalk.white(`│ Port: ${port}                              │`));
    console.log(chalk.dim(`│ Reason: ${reason.padEnd(34)}│`));
    console.log(chalk.yellow('│ Duration: Until session ends            │'));
    console.log(chalk.yellow('│ Allow? (y/n):                           │'));
    console.log(chalk.yellow('└─────────────────────────────────────────┘\n'));

    const response = await prompts({
      type: 'confirm',
      name: 'approved',
      message: `Expose port ${port} over the internet?`,
      initial: false,
    });

    if (!response.approved) {
      console.log(chalk.red('✗ Tunnel access denied\n'));
      return { approved: false };
    }

    try {
      // Check if port is available
      const portAvailable = await this.checkPortAvailable(port);
      if (!portAvailable) {
        const error = `Port ${port} is not accessible or not running`;
        console.log(chalk.red(`✗ ${error}\n`));
        return {
          approved: false,
          error,
        };
      }

      // Create tunnel
      console.log(chalk.dim('Creating tunnel...'));
      const tunnel = await tunnelManager.createTunnel({
        port,
        taskId,
        onError: (err) => console.error('Tunnel error:', err),
        onClose: () => console.log('Tunnel closed'),
      });

      console.log(chalk.green(`✓ Tunnel created: ${chalk.cyan(tunnel.url)}\n`));

      return {
        approved: true,
        tunnelUrl: tunnel.url,
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create tunnel';
      console.log(chalk.red(`✗ ${errorMsg}\n`));
      return {
        approved: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Check if a port is available/accessible
   */
  private async checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true); // Port is accessible
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.connect(port, 'localhost');
    });
  }
}
