#!/usr/bin/env node

/**
 * Test script to verify the AI agent works correctly with opencode SDK
 */

import { ConfigManager } from './dist/modules/config.js';
import { AiAgent } from './dist/modules/aiAgent.js';

async function test() {
  console.log('Testing AI Agent integration with opencode SDK...\n');

  const configManager = new ConfigManager();
  const config = configManager.loadConfig();

  if (!config.ai?.enabled) {
    console.error('Error: AI is not enabled. Run "codevf init" first.');
    process.exit(1);
  }

  console.log('Config loaded successfully.');
  console.log('AI enabled:', config.ai.enabled);
  console.log('Provider:', config.ai.provider);
  console.log();

  const aiAgent = new AiAgent(configManager);

  try {
    console.log('Sending prompt: "hi"\n');
    const result = await aiAgent.run('hi', {
      verbose: true,
      startServer: true
    });

    console.log('\n\nSuccess!');
    console.log('Output length:', result.output.length);
    console.log('Transcript entries:', result.transcript.length);

    process.exit(0);
  } catch (error) {
    console.error('\nError:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
