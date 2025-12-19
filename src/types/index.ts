// Core Types
export interface Config {
  projectId: string;
  allowedTools: string[];
  testCommand: string;
  buildCommand: string;
  repoUploaded: boolean;
  branchMode: string;
  createdAt: string;
  version: string;
  ai?: AiConfig;
  devServerPort?: number;
  tunnel?: TunnelConfig;
}

export interface TunnelConfig {
  allowTunnels: boolean;
  autoApprove: boolean;
  allowedPorts: number[];
  maxDuration: number; // milliseconds
}

export interface ActiveTunnel {
  url: string;
  port: number;
  subdomain?: string;
  createdAt: Date;
  taskId: string;
  password: string; // Required - always fetched with retry logic
}

export interface AiConfig {
  enabled: boolean;
  provider: 'opencode';
  sdk: AiSdkConfig;
  defaultArgs?: Record<string, any>;
  maxRunMs?: number | null;
  logTranscripts?: boolean;
  tools?: {
    consultEngineer?: {
      enabled: boolean;
      maxCreditsPerCall: number; // Default 10
      highUrgencyCredits: number; // Default 20
    };
  };
}

export interface AutoFallbackConfig {
  enabled: boolean;
  maxCredits: number;
  aiRetries?: number;
  vibeMode?: boolean; // AI asks engineer for context, then completes task
  vibeCredits?: number; // Credits for quick engineer consultation (1-3)
}

export interface AiSdkConfig {
  apiKeyEnv: string;
  defaultArgs?: Record<string, any>;
  model?: string | null;
  baseUrlEnv?: string;
}

// AI Tool Calling Types
export interface AiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: (params: any) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  creditsUsed?: number;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  callId: string; // For tracking
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
}

export interface LastSync {
  timestamp: string;
  commitHash: string;
  branch: string;
}

// Project Types
export type ProjectType = 'node' | 'python' | 'go' | 'ruby' | 'java' | 'rust' | 'unknown';

export interface ProjectDetection {
  type: ProjectType;
  confidence: number;
  indicators: string[];
  suggestedTestCommand?: string;
  suggestedBuildCommand?: string;
}

export interface InitWizardAnswers {
  projectType: ProjectType;
  testCommand: string;
  buildCommand: string;
  allowedTools: string[];
  uploadCode: boolean;
  allowBranchAccess: boolean;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  timestamp: string;
  payload: any;
}

export interface EngineerMessage extends WebSocketMessage {
  type: 'engineer_message';
  payload: {
    engineerId: string;
    engineerName: string;
    message: string;
  };
}

export interface CommandRequest extends WebSocketMessage {
  type: 'request_command';
  payload: {
    command: string;
    reason?: string;
  };
}

export interface FileRequest extends WebSocketMessage {
  type: 'request_file';
  payload: {
    filePath: string;
    reason?: string;
  };
}

export interface ScreenshareRequest extends WebSocketMessage {
  type: 'screenshare_request';
  payload: {
    url: string;
  };
}

export interface BillingUpdate extends WebSocketMessage {
  type: 'billing_update';
  payload: {
    creditsUsed: number;
    sessionDuration: number;
  };
}

export interface EngineerConnected extends WebSocketMessage {
  type: 'engineer_connected';
  payload: {
    engineerId: string;
    engineerName: string;
    engineerTitle: string;
  };
}

export interface SessionEnd extends WebSocketMessage {
  type: 'session_end';
  payload: {
    reason: string;
    summary: SessionSummary;
  };
}

export interface SessionSummary {
  engineerName: string;
  sessionDuration: number;
  creditsUsed: number;
  tasksCompleted: string[];
}

// Outgoing WebSocket Types
export interface CustomerMessage {
  type: 'customer_message';
  payload: {
    message: string;
  };
}

export interface ApproveCommand {
  type: 'approve_command';
  payload: {
    command: string;
    approved: boolean;
  };
}

export interface CommandOutput {
  type: 'command_output';
  payload: {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
  };
}

export interface ApproveFile {
  type: 'approve_file';
  payload: {
    filePath: string;
    approved: boolean;
  };
}

export interface FileUpload {
  type: 'file_upload';
  payload: {
    filePath: string;
    content: string;
  };
}

export interface RequestTunnel extends WebSocketMessage {
  type: 'request_tunnel';
  payload: {
    port: number;
    reason?: string;
    subdomain?: string;
  };
}

export interface TunnelShared extends WebSocketMessage {
  type: 'tunnel_shared';
  payload: {
    port: number;
    url: string;
    password: string; // Always included - fetched with retry logic
  };
}

export interface TunnelError extends WebSocketMessage {
  type: 'tunnel_error';
  payload: {
    port?: number;
    message: string;
  };
}

export interface TunnelRequest extends WebSocketMessage {
  type: 'tunnel_request';
  payload: {
    engineerId: string;
    suggestedPort: number;
    reason: string;
  };
}

export interface ApproveTunnel extends WebSocketMessage {
  type: 'approve_tunnel';
  payload: {
    tunnelUrl: string;
    port: number;
    password: string; // Required for bypassing loca.lt landing page
    expiresAt: string;
  };
}

export interface DenyTunnel extends WebSocketMessage {
  type: 'deny_tunnel';
  payload: {
    reason: string;
  };
}

export interface CloseTunnel extends WebSocketMessage {
  type: 'close_tunnel';
  payload: {
    tunnelUrl: string;
    closedBy: string;
  };
}

export interface TunnelApproved extends WebSocketMessage {
  type: 'tunnel_approved';
  payload: {
    tunnelUrl: string;
    port: number;
    password: string; // Required for bypassing loca.lt landing page
    expiresAt: string;
  };
}

export interface TunnelDenied extends WebSocketMessage {
  type: 'tunnel_denied';
  payload: {
    reason: string;
  };
}

export interface TunnelClosed extends WebSocketMessage {
  type: 'tunnel_closed';
  payload: {
    closedBy: string;
    tunnelUrl: string;
  };
}

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type TaskMode = 'realtime_answer' | 'realtime_chat' | 'fast' | 'standard';

// Action Context - automatic context gathered when creating a case
export interface ActionContext {
  git?: {
    branch: string;
    commitHash: string;
    isDirty: boolean;
    recentCommits?: Array<{
      hash: string;
      message: string;
      author: string;
      date: string;
    }>;
  };
  project: {
    type: string; // 'node', 'python', etc.
    rootPath: string;
    configExists: boolean;
  };
  environment?: {
    testCommand?: string;
    buildCommand?: string;
    allowedTools?: string[];
  };
  files?: {
    totalFiles: number;
    extensions: Record<string, number>; // { '.ts': 45, '.js': 12 }
    keyFiles: string[]; // ['package.json', 'tsconfig.json']
  };
  dependencies?: {
    production: string[];
    dev: string[];
  };
  timestamp: string;
}

export interface CreateTaskRequest {
  issueDescription: string;
  projectId: string;
  maxCredits?: number;
  taskMode?: TaskMode;
  contextData?: string; // JSON-stringified ActionContext
  initiatedBy?: 'customer' | 'ai_tool'; // Who initiated this task
  parentActionId?: number; // Link to parent action if tool-initiated
}

export interface CreateTaskResponse {
  taskId: string;
  estimatedWaitTime: number;
  warning?: string;
  creditsRemaining?: number;
  maxCreditsAllocated?: number;
}

export interface InitProjectRequest {
  projectType: ProjectType;
  testCommand: string;
  buildCommand: string;
  allowedTools: string[];
  repoUploaded: boolean;
}

export interface InitProjectResponse {
  projectId: string;
  uploadUrl?: string;
}

export interface SyncProjectRequest {
  projectId: string;
  commitHash: string;
  branch: string;
}

// Error Types
export class CodeVFError extends Error {
  code: string;
  recoverable: boolean;

  constructor(message: string, code: string, recoverable = false) {
    super(message);
    this.name = 'CodeVFError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

export class AuthError extends CodeVFError {
  constructor(message: string, recoverable = false) {
    super(message, 'AUTH_ERROR', recoverable);
    this.name = 'AuthError';
  }
}

export class NetworkError extends CodeVFError {
  constructor(message: string, recoverable = true) {
    super(message, 'NETWORK_ERROR', recoverable);
    this.name = 'NetworkError';
  }
}

export class ConfigError extends CodeVFError {
  constructor(message: string, recoverable = false) {
    super(message, 'CONFIG_ERROR', recoverable);
    this.name = 'ConfigError';
  }
}

export class PermissionError extends CodeVFError {
  constructor(message: string, recoverable = false) {
    super(message, 'PERMISSION_ERROR', recoverable);
    this.name = 'PermissionError';
  }
}

export class GitError extends CodeVFError {
  constructor(message: string, recoverable = false) {
    super(message, 'GIT_ERROR', recoverable);
    this.name = 'GitError';
  }
}
