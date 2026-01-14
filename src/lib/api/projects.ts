/**
 * Projects API wrapper for CodeVF-CLI
 */

import { ApiClient } from './client.js';
import { logger } from '../utils/logger.js';

export interface Project {
  id: number;
  repoUrl: string;
  problemDescription: string | null;
  status: string;
  createdAt: string;
}

export interface CreateProjectOptions {
  repoUrl: string;
  problemDescription?: string;
}

export class ProjectsApi {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  /**
   * List all projects for the authenticated user
   */
  async list(): Promise<Project[]> {
    logger.debug('Fetching projects list');

    const response = await this.client.get<{ projects: Project[] }>('/api/cli/projects');

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch projects');
    }

    const projects = response.projects ?? [];
    logger.info('Projects fetched', { count: projects.length });
    return projects;
  }

  /**
   * Create a new project
   */
  async create(options: CreateProjectOptions): Promise<Project> {
    logger.info('Creating project', { repoUrl: options.repoUrl });

    const response = await this.client.post<{ project: Project }>('/api/cli/projects', {
      repoUrl: options.repoUrl,
      problemDescription: options.problemDescription || null,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to create project');
    }

    const project = response.project;
    if (!project) {
      throw new Error('No project returned from API');
    }

    logger.info('Project created', { projectId: project.id });
    return project;
  }

  /**
   * Get or create a default project for instant queries
   */
  async getOrCreateDefault(): Promise<Project> {
    // Try to get existing projects
    const projects = await this.list();

    if (projects.length > 0) {
      // Use the most recent project
      const project = projects[0];
      logger.info('Using existing project', { projectId: project.id });
      return project;
    }

    // No projects exist, create a default one
    logger.info('No projects found, creating default project');
    return await this.create({
      repoUrl: 'CodeVF Instant Queries',
      problemDescription: 'Default project for quick questions and instant answers',
    });
  }
}
