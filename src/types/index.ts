export interface ActiveTunnel {
  url: string;
  port: number;
  subdomain?: string;
  createdAt: Date;
  taskId: string;
  password: string;
}

export type ProjectType = 'node' | 'python' | 'go' | 'ruby' | 'java' | 'rust' | 'unknown';

export interface ProjectDetection {
  type: ProjectType;
  confidence: number;
  indicators: string[];
  suggestedTestCommand?: string;
  suggestedBuildCommand?: string;
}
