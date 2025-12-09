import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthManager } from './auth.js';
import {
  ApiResponse,
  NetworkError,
  AuthError,
  CreateTaskRequest,
  CreateTaskResponse,
  InitProjectRequest,
  InitProjectResponse,
  SyncProjectRequest,
} from '../types/index.js';

const API_BASE_URL = process.env.CODEVF_API_URL || 'https://api.codevf.com';

export class ApiClient {
  private client: AxiosInstance;
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.authManager.isAuthenticated()) {
          config.headers.Authorization = `Bearer ${this.authManager.getAccessToken()}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new NetworkError('Cannot connect to CodeVF servers.\nPlease check your internet connection.');
        }

        const data: any = error.response?.data || {};
        const serverError = data?.error;
        const help = data?.help ? `\n${data.help}` : '';

        if (error.response?.status === 401) {
          throw new AuthError((serverError || 'Authentication failed.\nPlease run: codevf login') + help);
        }

        if (error.response?.status === 403) {
          throw new AuthError((serverError || 'Access denied. Please check your permissions.') + help);
        }

        if (error.response?.status === 400) {
          throw new NetworkError((serverError || `API request failed: ${error.message}`) + help);
        }

        throw new NetworkError((serverError || `API request failed: ${error.message}`) + help);
      }
    );
  }

  // Auth endpoints
  async initAuth(): Promise<{ authUrl: string; pollToken: string }> {
    const response = await this.client.post<ApiResponse>('/api/cli/auth/init');
    return response.data.data;
  }

  async pollAuth(pollToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const response = await this.client.post<ApiResponse>('/api/cli/auth/token', { pollToken });
    return response.data.data;
  }

  // Project endpoints
  async getProjects(): Promise<{ projects: any[] }> {
    const response = await this.client.get<{ projects: any[] }>('/api/cli/projects');
    return response.data;
  }

  async createProject(repoUrl: string, problemDescription?: string): Promise<{ project: any }> {
    const response = await this.client.post<any>('/api/cli/projects', {
      repoUrl,
      problemDescription,
    });
    return response.data;
  }

  async initProject(request: InitProjectRequest): Promise<InitProjectResponse> {
    const response = await this.client.post<ApiResponse<InitProjectResponse>>('/project/init', request);
    return response.data.data!;
  }

  async syncProject(request: SyncProjectRequest): Promise<void> {
    await this.client.post('/project/sync', request);
  }

  async uploadRepoSnapshot(projectId: string, zipBuffer: Buffer): Promise<void> {
    const formData = new FormData();
    const blob = new Blob([zipBuffer], { type: 'application/zip' });
    formData.append('file', blob, 'repo.zip');
    formData.append('projectId', projectId);

    await this.client.post('/api/cli/upload-repo-snapshot', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes for large uploads
    });
  }

  // Task endpoints
  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse & { warning?: string }> {
    const response = await this.client.post<ApiResponse<CreateTaskResponse>>('/api/cli/tasks/create', request);
    const data = response.data as any;
    return { ...data.data, warning: data.data?.warning || data.warning };
  }

  async sendMessage(taskId: string, message: string): Promise<void> {
    await this.client.post(`/api/cli/tasks/${taskId}/send-message`, { message });
  }

  async approveCommand(taskId: string, command: string, approved: boolean): Promise<void> {
    await this.client.post(`/api/cli/tasks/${taskId}/approve-command`, { command, approved });
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.client.post(`/api/cli/tasks/${taskId}/cancel`);
  }

  async uploadFile(taskId: string, filePath: string, content: string): Promise<void> {
    await this.client.post(`/api/cli/tasks/${taskId}/upload-file`, { filePath, content });
  }

  async endSession(taskId: string): Promise<void> {
    await this.client.post(`/api/cli/tasks/${taskId}/end-session`);
  }

  async rateEngineer(taskId: string, rating: number, feedback?: string): Promise<void> {
    await this.client.post(`/api/cli/tasks/${taskId}/rate`, { rating, feedback });
  }

  async getTaskStatus(taskId: string): Promise<{
    taskId: number;
    status: string;
    actualCreditsUsed?: string;
    response?: string;
    engineerName?: string;
  }> {
    const response = await this.client.get<ApiResponse>(`/api/cli/tasks/${taskId}/status`);
    return response.data.data;
  }

  getWebSocketUrl(taskId: string, token: string): string {
    // For the custom server, WebSocket is at /ws with query params
    const baseUrl = process.env.CODEVF_API_URL || API_BASE_URL;
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://').replace('/api/cli', '');
    return `${wsUrl}/ws?taskId=${taskId}&userType=customer&token=${token}`;
  }
}
