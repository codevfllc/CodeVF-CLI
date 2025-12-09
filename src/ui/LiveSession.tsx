import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { WebSocketClient } from '../modules/websocket.js';
import { PermissionManager } from '../modules/permissions.js';
import { ApiClient } from '../modules/api.js';
import { TunnelManager } from '../modules/tunnel.js';
import { ActiveTunnel } from '../types/index.js';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { useRef } from 'react';

const execAsync = promisify(exec);

const COMMANDS = [
  { cmd: '/hybrid', description: 'Hybrid mode (AI → Human) (active)' },
  { cmd: '/ai', description: 'Use AI mode only' },
  { cmd: '/human', description: 'Request human engineer' },
  { cmd: '/shell', description: 'Switch to local shell (not shared)' },
  { cmd: '/tunnel <port>', description: 'Share a local port over the internet' },
  { cmd: '/close-tunnel', description: 'Close the active tunnel' },
  { cmd: '/resume', description: 'Return from shell to session' },
  { cmd: '/?', description: 'Show all commands' },
  { cmd: '/help', description: 'Show all commands' },
  { cmd: '/end', description: 'End the session' },
];

interface Message {
  timestamp: string;
  sender: 'engineer' | 'customer' | 'system';
  content: string;
}

interface LiveSessionProps {
  taskId: string;
  wsClient: WebSocketClient;
  apiClient: ApiClient;
  permissionManager: PermissionManager;
  tunnelManager: TunnelManager;
}

export const LiveSession: React.FC<LiveSessionProps> = ({
  taskId,
  wsClient,
  apiClient,
  permissionManager,
  tunnelManager,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [engineerName, setEngineerName] = useState<string | null>(null);
  const [engineerTitle, setEngineerTitle] = useState<string>('');
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [_sessionDuration, setSessionDuration] = useState(0);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const { exit } = useApp();
  const endingRef = useRef(false);
  const [mode, setMode] = useState<'session' | 'shell'>('session');
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [activeTunnel, setActiveTunnel] = useState<ActiveTunnel | null>(null);
  const lastInputTimeRef = useRef<number>(0);
  const blockReturnsUntilRef = useRef<number>(0);

  const shareTunnel = useCallback(async (
    port: number,
    subdomain?: string,
    reason?: string,
    requestedByEngineer = false
  ): Promise<ActiveTunnel | null> => {
    if (requestedByEngineer) {
      const approved = await permissionManager.requestTunnelPermission(port, reason);
      if (!approved) {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: `✗ Tunnel request denied for port ${port}`,
          },
        ]);

        try {
          wsClient.send({
            type: 'tunnel_error',
            timestamp: new Date().toISOString(),
            payload: { port, message: 'Denied by customer' },
          });
        } catch (error) {
          // best-effort
        }

        return null;
      }
    }

    setIsProcessingRequest(true);
    try {
      const tunnel = await tunnelManager.createTunnel({ port, subdomain, taskId });
      setActiveTunnel(tunnel);

      const tunnelMessage = `🔗 Tunnel shared: ${tunnel.url} (port ${tunnel.port})`;
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: tunnelMessage,
        },
      ]);

      try {
        wsClient.send({
          type: 'tunnel_shared',
          timestamp: new Date().toISOString(),
          payload: { port: tunnel.port, url: tunnel.url },
        });
      } catch (error) {
        // best-effort to notify engineer
      }

      try {
        await apiClient.sendMessage(taskId, tunnelMessage);
      } catch (error) {
        // sending message is best-effort; continue
      }

      return tunnel;
    } catch (error: any) {
      const message = error?.message || 'Failed to create tunnel';

      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: `✗ ${message}`,
        },
      ]);

      try {
        wsClient.send({
          type: 'tunnel_error',
          timestamp: new Date().toISOString(),
          payload: { port, message },
        });
      } catch (sendError) {
        // ignore
      }

      return null;
    } finally {
      setIsProcessingRequest(false);
    }
  }, [apiClient, permissionManager, taskId, tunnelManager, wsClient]);

  const closeActiveTunnel = useCallback(async (): Promise<void> => {
    if (!activeTunnel) {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: 'No active tunnel to close.',
        },
      ]);
      return;
    }

    setIsProcessingRequest(true);
    try {
      await tunnelManager.closeTunnel();
      setActiveTunnel(null);
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: `Tunnel closed for port ${activeTunnel.port}`,
        },
      ]);
    } finally {
      setIsProcessingRequest(false);
    }
  }, [activeTunnel, tunnelManager]);

  useEffect(() => {
    // Enable bracketed paste mode
    process.stdout.write('\x1b[?2004h');

    return () => {
      // Disable bracketed paste mode on unmount
      process.stdout.write('\x1b[?2004l');
    };
  }, []);

  useEffect(() => {
    // Add initial message with status and commands
    const initMessage = `[initialized] • 🤖 [Hybrid+Vibe: 240 credits max]

AI=OpenCode (free w/ limits), Vibe=2-3 credits, Human=2 credits/min • /? for info

Quick commands:
/hybrid - Hybrid mode (AI → Human) (active)
/ai     - Use AI mode only
/human  - Request human engineer
/shell  - Local shell (not shared)
/tunnel <port> - Share a local port via secure tunnel
/?      - Show all commands
/end    - End session

🔗 Connecting to engineer...`;

    setMessages([
      {
        timestamp: new Date().toISOString(),
        sender: 'system',
        content: initMessage,
      },
    ]);

    // WebSocket event handlers
    wsClient.on('engineer_connected', (data: any) => {
      setEngineerName(data.payload.engineerName);
      setEngineerTitle(data.payload.engineerTitle);

      // Only add message if not already connected (prevent duplicates)
      if (!engineerName) {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: 'Engineer connected',
          },
        ]);
      }
    });

    wsClient.on('engineer_message', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: data.timestamp,
          sender: 'engineer',
          content: data.payload.message,
        },
      ]);
    });

    wsClient.on('billing_update', (data: any) => {
      setCreditsUsed(data.payload.creditsUsed);
      setSessionDuration(data.payload.sessionDuration);
    });

    wsClient.on('request_command', async (data: any) => {
      setIsProcessingRequest(true);
      const { command, reason } = data.payload;

      const approved = await permissionManager.requestCommandPermission(command, reason);

      if (approved) {
        try {
          const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
          await apiClient.approveCommand(taskId, command, true);

          // Show output locally
          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content:
                `✓ Command executed: ${command}\n${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim(),
            },
          ]);

          wsClient.send({
            type: 'command_output',
            timestamp: new Date().toISOString(),
            payload: {
              command,
              exitCode: 0,
              stdout,
              stderr,
            },
          });
        } catch (error: any) {
          wsClient.send({
            type: 'command_output',
            timestamp: new Date().toISOString(),
            payload: {
              command,
              exitCode: error.code || 1,
              stdout: error.stdout || '',
              stderr: error.stderr || error.message,
            },
          });

          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content: `✗ Command failed: ${command}\n${error.stdout || ''}${error.stderr || error.message || ''}`,
            },
          ]);
        }
      } else {
        await apiClient.approveCommand(taskId, command, false);
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: `✗ Command denied: ${command}`,
          },
        ]);
      }

      setIsProcessingRequest(false);
    });

    wsClient.on('request_file', async (data: any) => {
      setIsProcessingRequest(true);
      const { filePath, reason } = data.payload;

      const approved = await permissionManager.requestFilePermission(filePath, reason);

      if (approved) {
        try {
          const fullPath = `${process.cwd()}/${filePath}`;
          const content = fs.readFileSync(fullPath, 'utf-8');
          await apiClient.uploadFile(taskId, filePath, content);

          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content: `✓ File shared: ${filePath}`,
            },
          ]);
        } catch (error: any) {
          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content: `✗ Failed to read file: ${filePath}`,
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: `✗ File access denied: ${filePath}`,
          },
        ]);
      }

      setIsProcessingRequest(false);
    });

    wsClient.on('request_tunnel', async (data: any) => {
      const { port, reason, subdomain } = data.payload;
      await shareTunnel(port, subdomain, reason, true);
    });

    wsClient.on('screenshare_request', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: `📹 Engineer requests screenshare: ${data.payload.url}`,
        },
      ]);
    });

    wsClient.on('closure_request', (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: data.timestamp,
          sender: 'system',
          content: `Engineer requests to close the session: ${data.payload?.reason || ''}`.trim(),
        },
      ]);
    });

    wsClient.on('session_end', async (data: any) => {
      const endedBy = data?.payload?.endedBy || 'engineer';
      const endMessage =
        endedBy === 'customer' ? 'Session ended by User' : 'Session ended by engineer';

      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: endMessage,
        },
      ]);

      // Ensure tunnels are closed when session ends
      void tunnelManager.closeTunnel().then(() => setActiveTunnel(null));

      // Show summary and exit after a delay
      setTimeout(() => exit(), 2000);
    });

    wsClient.on('error', (error: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: `Error: ${error.message}`,
        },
      ]);
    });

    wsClient.on('reconnecting', (attempt: number) => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: `Reconnecting... (attempt ${attempt})`,
        },
      ]);
    });

    wsClient.on('disconnected', () => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: 'Connection lost. Any active tunnels will be closed.',
        },
      ]);

      // Close tunnel best-effort
      void tunnelManager.closeTunnel().then(() => setActiveTunnel(null));
    });

    return () => {
      wsClient.removeAllListeners();
    };
  }, [wsClient, taskId, apiClient, permissionManager, exit, tunnelManager, shareTunnel]);

  const processReturnKey = () => {
    if (!inputBuffer.trim()) {
      return;
    }
    const message = inputBuffer.trim();

    // Shell mode handling
    if (mode === 'shell') {
      if (message === '/resume' || message === '/session') {
        setMode('session');
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: 'Back to session (messages will be shared with engineer).',
          },
        ]);
        setInputBuffer('');
        return;
      }

      if (message === '/end') {
        endSession();
        setInputBuffer('');
        return;
      }

      if (message === '/shell') {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: 'Already in shell mode. Type /resume to return to session.',
          },
        ]);
        setInputBuffer('');
        return;
      }

      if (message === '/help' || message === '/?') {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system' as const,
            content: 'Available commands:',
          },
          ...COMMANDS.map((c) => ({
            timestamp: new Date().toISOString(),
            sender: 'system' as const,
            content: `${c.cmd} — ${c.description}`,
          })),
        ]);
        setInputBuffer('');
        return;
      }

      if (message.startsWith('/')) {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: `Unknown command in shell: ${message}`,
          },
        ]);
        setInputBuffer('');
        return;
      }

      // Execute local command
      (async () => {
        try {
          const { stdout, stderr } = await execAsync(message, { cwd: process.cwd() });
          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content: `$ ${message}\n${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim(),
            },
          ]);
        } catch (error: any) {
          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content: `$ ${message}\n${error.stdout || ''}${error.stderr || error.message || 'Command failed'}`,
            },
          ]);
        }
      })();

      setInputBuffer('');
      return;
    }

    // Session mode handling
    if (message === '/end') {
      endSession();
      setInputBuffer('');
      return;
    }

    if (message === '/hybrid') {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: 'Switched to Hybrid mode (AI → Human fallback). This is the default mode.',
        },
      ]);
      setInputBuffer('');
      return;
    }

    if (message === '/ai') {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: 'Switched to AI-only mode. Only AI assistance will be used.',
        },
      ]);
      setInputBuffer('');
      return;
    }

    if (message === '/human') {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: 'Requesting human engineer... (2 credits/min)',
        },
      ]);
      setInputBuffer('');
      return;
    }

    if (message === '/help' || message === '/?') {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system' as const,
          content: 'Available commands:',
        },
        ...COMMANDS.map((c) => ({
          timestamp: new Date().toISOString(),
          sender: 'system' as const,
          content: `${c.cmd} — ${c.description}`,
        })),
      ]);
      setInputBuffer('');
      return;
    }

    if (message === '/shell') {
      setMode('shell');
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content:
            'Switched to local shell mode (commands are NOT shared with engineer). Type /resume to return.',
        },
      ]);
      setInputBuffer('');
      return;
    }

    if (message.startsWith('/tunnel')) {
      const parts = message.split(' ').filter(Boolean);
      const port = Number(parts[1]);
      if (!port || Number.isNaN(port)) {
        setMessages((prev) => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            sender: 'system',
            content: 'Usage: /tunnel <port>',
          },
        ]);
        setInputBuffer('');
        return;
      }

      void shareTunnel(port);
      setInputBuffer('');
      return;
    }

    if (message === '/close-tunnel') {
      void closeActiveTunnel();
      setInputBuffer('');
      return;
    }

    wsClient.send({
      type: 'customer_message',
      timestamp: new Date().toISOString(),
      payload: { message },
    });

    setMessages((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        sender: 'customer',
        content: message,
      },
    ]);

    setInputBuffer('');
  };

  const endSession = async (reason = 'Customer ended session'): Promise<void> => {
    if (endingRef.current) return;
    endingRef.current = true;

    try {
      wsClient.send({
        type: 'end_session',
        timestamp: new Date().toISOString(),
        payload: { reason, endedBy: 'customer' },
      });
    } catch (error) {
      // ignore send errors on shutdown
    }

    try {
      await apiClient.endSession(taskId);
    } catch (error) {
      // best-effort; still proceed to exit
    }

    try {
      await tunnelManager.closeTunnel();
      setActiveTunnel(null);
    } catch (error) {
      // ignore cleanup errors
    }

    try {
      wsClient.disconnect();
    } catch (error) {
      // ignore
    }

    setTimeout(() => exit(), 200);
  };

  useInput(
    (input: string, key: any) => {
      const now = Date.now();

      // DEBUG: Log all inputs (remove after testing)
      if (process.env.CODEVF_DEBUG) {
        console.error(
          `[DEBUG] input="${input}" length=${input?.length} key.return=${key.return} key.sequence="${key.sequence}" isPasteMode=${isPasteMode}`
        );
      }

      // Handle bracketed paste mode sequences
      if (key.sequence === '\x1b[200~') {
        setIsPasteMode(true);
        blockReturnsUntilRef.current = now + 500;
        return;
      }

      if (key.sequence === '\x1b[201~') {
        setIsPasteMode(false);
        // Allow returns again after 100ms
        blockReturnsUntilRef.current = now + 100;
        return;
      }

      // If we receive ANY text input (not a control key), block returns for 100ms
      // This catches paste operations even without bracketed paste mode
      if (input && input.length > 0 && !key.return && !key.backspace && !key.delete) {
        lastInputTimeRef.current = now;
        blockReturnsUntilRef.current = now + 100;

        // If multi-character input, definitely a paste
        if (input.length > 1) {
          setIsPasteMode(true);
          blockReturnsUntilRef.current = now + 300;
        }

        // Strip newlines from input and add to buffer
        const sanitized = input.replace(/[\r\n]+/g, ' ');
        if (sanitized) {
          setInputBuffer((prev) => prev + sanitized);
        }
        return;
      }

      // Handle return key
      if (key.return) {
        // If returns are blocked (recent text input), ignore this return
        if (now < blockReturnsUntilRef.current) {
          if (process.env.CODEVF_DEBUG) {
            console.error(`[DEBUG] Return blocked for ${blockReturnsUntilRef.current - now}ms`);
          }
          setIsPasteMode(true);
          // Extend block period
          blockReturnsUntilRef.current = now + 100;
          return;
        }

        // Returns are not blocked - this is a real Enter key press
        setIsPasteMode(false);
        processReturnKey();
        return;
      }

      // Handle backspace/delete
      if (key.backspace || key.delete) {
        setInputBuffer((prev) => prev.slice(0, -1));
        return;
      }
    },
    { isActive: !isProcessingRequest }
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="magenta" paddingX={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="magenta" backgroundColor="black">
            CodeVF Engineer Session
          </Text>
          {engineerName && (
            <Text color="cyan">
              Engineer: {engineerName}{' '}
              {engineerTitle && <Text color="gray">({engineerTitle})</Text>}
            </Text>
          )}
          <Text color="yellow">
            💰 Credits: {creditsUsed} credit{creditsUsed !== 1 ? 's' : ''} used • Press CTRL+C to
            exit
          </Text>
        </Box>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        flexGrow={1}
        marginBottom={1}
      >
        {messages.slice(-15).map((msg, idx) => (
          <Box key={idx} marginBottom={0}>
            <Text dimColor>[{formatTime(msg.timestamp)}]</Text>
            <Text> </Text>
            {msg.sender === 'engineer' && (
              <>
                <Text color="magenta" bold backgroundColor="black">
                  Engineer:
                </Text>
                <Text> </Text>
              </>
            )}
            {msg.sender === 'customer' && (
              <>
                <Text color="green" bold backgroundColor="black">
                  👤 You:
                </Text>
                <Text> </Text>
              </>
            )}
            {msg.sender === 'system' && (
              <>
                <Text color="yellow" bold backgroundColor="blue">
                  ℹ️ System:
                </Text>
                <Text> </Text>
              </>
            )}
            {msg.sender === 'engineer' ? (
              <Text color="cyan" backgroundColor="black">
                {msg.content}
              </Text>
            ) : (
              <Text>{msg.content}</Text>
            )}
          </Box>
        ))}
      </Box>

      <Box borderStyle="round" borderColor={mode === 'shell' ? 'yellow' : 'magenta'} paddingX={1}>
        <Text color={mode === 'shell' ? 'yellow' : 'magenta'} bold>
          {mode === 'shell' ? '🐚 Local> ' : '💬 Chat: '}
        </Text>
        <Text>{inputBuffer}</Text>
        <Text color="gray">▌</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={isPasteMode ? 'yellow' : 'cyan'}>
          {isPasteMode
            ? '📋 Paste mode active - Press Enter when done pasting'
            : mode === 'shell'
              ? '🔒 Shell mode (not shared). /resume to return, /? for commands.'
              : '💡 Quick: /auto /ai /human /shell /tunnel /? /end'}
        </Text>
      </Box>
    </Box>
  );
};
