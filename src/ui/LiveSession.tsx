import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { WebSocketClient } from '../modules/websocket.js';
import { PermissionManager } from '../modules/permissions.js';
import { ApiClient } from '../modules/api.js';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
}

export const LiveSession: React.FC<LiveSessionProps> = ({
  taskId,
  wsClient,
  apiClient,
  permissionManager,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [engineerName, setEngineerName] = useState<string | null>(null);
  const [engineerTitle, setEngineerTitle] = useState<string>('');
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const { exit } = useApp();

  useEffect(() => {
    // Add initial message
    setMessages([
      {
        timestamp: new Date().toISOString(),
        sender: 'system',
        content: 'Connecting to engineer...',
      },
    ]);

    // WebSocket event handlers
    wsClient.on('engineer_connected', (data: any) => {
      setEngineerName(data.payload.engineerName);
      setEngineerTitle(data.payload.engineerTitle);
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: `Engineer connected: ${data.payload.engineerName} (${data.payload.engineerTitle})`,
        },
      ]);
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

          setMessages((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              sender: 'system',
              content: `✓ Command executed: ${command}`,
            },
          ]);
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
              content: `✗ Command failed: ${command}`,
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

    wsClient.on('session_end', async (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          sender: 'system',
          content: 'Session ended by engineer',
        },
      ]);

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

    return () => {
      wsClient.removeAllListeners();
    };
  }, [wsClient, taskId, apiClient, permissionManager, exit]);

  useInput(
    (input: string, key: any) => {
      if (key.return && inputBuffer.trim()) {
        // Send message
        const message = inputBuffer.trim();
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
      } else if (key.backspace || key.delete) {
        setInputBuffer((prev) => prev.slice(0, -1));
      } else if (!key.ctrl && !key.meta && input) {
        setInputBuffer((prev) => prev + input);
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
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">
            CodeVF Live Session
          </Text>
          {engineerName && (
            <Text color="white">
              Engineer: {engineerName} {engineerTitle && <Text dimColor>({engineerTitle})</Text>}
            </Text>
          )}
          <Text dimColor>
            Billing: {creditsUsed} credit{creditsUsed !== 1 ? 's' : ''} used • Press CTRL+C to exit
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
            {msg.sender === 'engineer' && <Text color="green">{engineerName || 'Engineer'}:</Text>}
            {msg.sender === 'customer' && <Text color="blue">You:</Text>}
            {msg.sender === 'system' && <Text color="yellow">System:</Text>}
            <Text> {msg.content}</Text>
          </Box>
        ))}
      </Box>

      <Box borderStyle="round" borderColor="blue" paddingX={1}>
        <Text color="blue">You: </Text>
        <Text>{inputBuffer}</Text>
        <Text color="gray">▌</Text>
      </Box>
    </Box>
  );
};
