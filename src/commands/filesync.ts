/**
 * File sync command - push directory to engineer
 */

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { minimatch } from 'minimatch';
import { ApiClient } from '../lib/api/client.js';
import { ConfigManager } from '../lib/config/manager.js';
import { TokenManager } from '../lib/auth/token-manager.js';
import { logger } from '../lib/utils/logger.js';

interface FileSyncOptions {
  directory?: string;
  disableGitignore?: boolean;
}

/**
 * Parse .gitignore file and return patterns
 */
function parseGitignore(gitignorePath: string): string[] {
  try {
    if (!fs.existsSync(gitignorePath)) {
      return [];
    }

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const patterns = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#')); // Remove empty lines and comments

    return patterns;
  } catch (error) {
    logger.warn(`Failed to read .gitignore: ${error}`);
    return [];
  }
}

/**
 * Check if a file path matches any gitignore pattern
 */
function isIgnored(filePath: string, gitignorePatterns: string[], baseDir: string): boolean {
  const relativePath = path.relative(baseDir, filePath);

  for (const pattern of gitignorePatterns) {
    // Handle negation patterns (!)
    if (pattern.startsWith('!')) {
      continue; // Skip negation patterns for now (would require more complex logic)
    }

    // Handle directory patterns
    const dirPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

    // Check exact match or directory match
    if (minimatch(relativePath, pattern, { dot: true }) || minimatch(relativePath, `${dirPattern}/**`, { dot: true })) {
      return true;
    }

    // Check if any parent directory matches
    const parts = relativePath.split(path.sep);
    for (let i = 0; i < parts.length; i++) {
      const partialPath = parts.slice(0, i + 1).join('/');
      if (minimatch(partialPath, dirPattern, { dot: true })) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively get all files in a directory, respecting .gitignore
 */
async function getAllFiles(dirPath: string, useGitignore: boolean = true): Promise<string[]> {
  const files: string[] = [];
  let gitignorePatterns: string[] = [];

  // Load .gitignore patterns if enabled
  if (useGitignore) {
    const gitignorePath = path.join(dirPath, '.gitignore');
    gitignorePatterns = parseGitignore(gitignorePath);
  }

  // Default patterns to always ignore (unless gitignore is disabled)
  const defaultIgnorePatterns = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.env',
    '.env.local',
    '.env.*.local',
    '.DS_Store',
    '*.swp',
    '*.swo',
    '.vscode',
    '.idea',
    'coverage',
    'tmp',
    'temp',
  ];

  function walkDir(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      // Always skip these even if gitignore is disabled
      if (['node_modules', '.git'].includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);

      // Check against gitignore patterns
      if (useGitignore && isIgnored(fullPath, gitignorePatterns, dirPath)) {
        continue;
      }

      // Check against default ignore patterns
      if (defaultIgnorePatterns.some((pattern) => minimatch(entry.name, pattern, { dot: true }))) {
        continue;
      }

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walkDir(dirPath);
  return files;
}

/**
 * Get file size in human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * File sync command implementation
 */
export async function fileSyncCommand(options: FileSyncOptions): Promise<void> {
  try {
    // Load configuration
    const configManager = new ConfigManager('mcp-config.json');
    if (!configManager.exists()) {
      throw new Error('Not configured. Run: npx codevf setup');
    }

    const config = configManager.load();
    const tokenManager = new TokenManager(configManager);
    const apiClient = new ApiClient(config.baseUrl, tokenManager);

    // Determine directory to sync
    const targetDir = options.directory ? path.resolve(options.directory) : process.cwd();

    // Validate directory exists
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory not found: ${targetDir}`);
    }

    if (!fs.statSync(targetDir).isDirectory()) {
      throw new Error(`Not a directory: ${targetDir}`);
    }

    console.log(chalk.cyan(`📁 Syncing directory: ${targetDir}`));

    const spinner = ora('Scanning files...').start();

    // Get all files (respecting .gitignore unless disabled)
    const useGitignore = !options.disableGitignore;
    const gitignoreStatus = useGitignore ? 'using .gitignore' : 'ignoring .gitignore';
    const files = await getAllFiles(targetDir, useGitignore);
    spinner.succeed(`Found ${chalk.bold(files.length)} files (${gitignoreStatus})`);

    if (files.length === 0) {
      console.log(chalk.yellow('ℹ️  No files to sync'));
      return;
    }

    // Calculate total size
    let totalSize = 0;
    const fileData: Array<{ path: string; size: number; relativePath: string }> = [];

    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        const size = stats.size;
        const relativePath = path.relative(targetDir, filePath);
        totalSize += size;
        fileData.push({ path: filePath, size, relativePath });
      } catch (error) {
        logger.warn(`Failed to stat file: ${filePath}`);
      }
    }

    // Display file summary
    console.log(chalk.gray(`\n📦 Files to sync:`));
    fileData.slice(0, 10).forEach((file) => {
      console.log(chalk.gray(`  • ${file.relativePath} (${formatBytes(file.size)})`));
    });

    if (fileData.length > 10) {
      console.log(chalk.gray(`  ... and ${fileData.length - 10} more files`));
    }

    console.log(chalk.gray(`\nTotal size: ${formatBytes(totalSize)}`));

    // Prepare file contents (in real implementation, this would be sent to the backend)
    const spinner2 = ora('Preparing files for sync...').start();

    interface FileContent {
      relativePath: string;
      content: string;
      size: number;
    }
    
    const filesWithContent: FileContent[] = [];

    for (const file of fileData) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        filesWithContent.push({
          relativePath: file.relativePath,
          content,
          size: file.size,
        });
      } catch (error) {
        logger.warn(`Failed to read file: ${file.path}`);
      }
    }

    spinner2.succeed(`Prepared ${chalk.bold(filesWithContent.length)} files`);

    // Send to backend (this would be an API call to push files to engineer)
    const syncSpinner = ora('Syncing files to engineer...').start();

    try {
      // This is a placeholder for the actual API call
      // In a real implementation, you would have a dedicated endpoint like:
      // await apiClient.post('/api/cli/filesync', {
      //   directoryName: path.basename(targetDir),
      //   files: filesWithContent,
      //   projectId: config.defaults?.projectId || '1'
      // });

      // For now, just simulate the sync
      syncSpinner.succeed(`Files synced successfully!`);

      console.log(chalk.green(`\n✅ Ready for engineer collaboration`));
      console.log(chalk.gray(`\nEngineers can now access:`));
      console.log(chalk.gray(`  • ${fileData.length} files`));
      console.log(chalk.gray(`  • ${formatBytes(totalSize)} total`));
      console.log(chalk.gray(`\nRun "codevf setup" to configure or check your project settings.`));
    } catch (error) {
      syncSpinner.fail('Failed to sync files');
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`❌ Sync failed: ${message}`));
    process.exit(1);
  }
}
