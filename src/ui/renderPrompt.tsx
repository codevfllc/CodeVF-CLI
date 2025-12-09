import React from 'react';
import { render } from 'ink';
import { PromptInput } from './PromptInput.js';
import { RoutingMode } from '../modules/constants.js';

interface RenderPromptOptions {
  routingMode: RoutingMode;
  aiEnabled: boolean;
  autoAcceptMode: boolean;
  history?: string[];
  onToggle: (mode: RoutingMode) => void;
  onAutoAcceptToggle: (autoAccept: boolean) => void;
}

export async function renderPrompt(options: RenderPromptOptions): Promise<string> {
  return new Promise((resolve) => {
    const { unmount, waitUntilExit } = render(
      <PromptInput
        routingMode={options.routingMode}
        aiEnabled={options.aiEnabled}
        autoAcceptMode={options.autoAcceptMode}
        history={options.history}
        onSubmit={(value) => {
          // Unmount the component first to clear the screen
          unmount();
          // Then resolve with the value
          resolve(value);
        }}
        onToggleMode={options.onToggle}
        onToggleAutoAccept={options.onAutoAcceptToggle}
      />
    );
  });
}
