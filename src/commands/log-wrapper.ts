#!/usr/bin/env node

/**
 * Log Wrapper - Intercepts console output and writes properly formatted logs to logs.txt
 *
 * Usage:
 *   tsx src/commands/log-wrapper.ts "npm run dev"
 *   OR
 *   node log-wrapper.js "npm run build"
 *
 * This script:
 * 1. Runs the specified command
 * 2. Intercepts console.log/error/warn/info
 * 3. Properly serializes objects with JSON.stringify
 * 4. Writes to logs.txt with timestamps
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const logsPath = path.join(process.cwd(), 'logs.txt');

// Clear or create logs file
fs.writeFileSync(logsPath, '', 'utf-8');

function writeLog(level: string, args: any[]): void {
  const timestamp = new Date().toISOString();

  // Serialize each argument properly
  const formattedArgs = args.map((arg) => {
    if (typeof arg === 'string') {
      return arg;
    } else if (arg === null) {
      return 'null';
    } else if (arg === undefined) {
      return 'undefined';
    } else if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    } else {
      return String(arg);
    }
  });

  const message = formattedArgs.join(' ');
  const logLine = `[${timestamp}] [${level}] ${message}\n`;

  // Append to logs.txt
  fs.appendFileSync(logsPath, logLine, 'utf-8');

  // Also output to console for real-time feedback
  console.log(logLine.trim());
}

// Get the command from arguments
const command = process.argv[2];
if (!command) {
  console.error('Usage: log-wrapper <command>');
  console.error('Example: log-wrapper "npm run dev"');
  process.exit(1);
}

// Parse command and arguments
const [cmd, ...cmdArgs] = command.split(' ');

console.log(`Starting command: ${command}`);
console.log(`Logs will be written to: ${logsPath}\n`);

// Spawn the child process
const child = spawn(cmd, cmdArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

// Intercept stdout
if (child.stdout) {
  child.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        writeLog('stdout', [line]);
      }
    }
  });
}

// Intercept stderr
if (child.stderr) {
  child.stderr.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        writeLog('stderr', [line]);
      }
    }
  });
}

// Handle process exit
child.on('exit', (code) => {
  writeLog('info', [`Process exited with code ${code}`]);
  process.exit(code || 0);
});

child.on('error', (err) => {
  writeLog('error', [`Failed to start process: ${err.message}`]);
  process.exit(1);
});
