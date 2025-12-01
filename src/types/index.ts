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

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateTaskRequest {
  issueDescription: string;
  projectId: string;
  maxCredits?: number;
}

export interface CreateTaskResponse {
  taskId: string;
  estimatedWaitTime: number;
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
