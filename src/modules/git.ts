import simpleGit, { SimpleGit } from 'simple-git';
import { GitError } from '../types/index.js';

export class GitManager {
  private git: SimpleGit;

  constructor(cwd: string = process.cwd()) {
    this.git = simpleGit(cwd);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status();
      return status.current || '';
    } catch (error) {
      throw new GitError(`Failed to get current branch: ${error}`);
    }
  }

  async getCommitHash(): Promise<string> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash || '';
    } catch (error) {
      throw new GitError(`Failed to get commit hash: ${error}`);
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return !status.isClean();
    } catch (error) {
      throw new GitError(`Failed to check git status: ${error}`);
    }
  }

  async createBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkoutLocalBranch(branchName);
    } catch (error) {
      throw new GitError(`Failed to create branch '${branchName}': ${error}`);
    }
  }

  async switchBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkout(branchName);
    } catch (error) {
      throw new GitError(`Failed to switch to branch '${branchName}': ${error}`);
    }
  }

  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branchLocal();
      return branches.all.includes(branchName);
    } catch {
      return false;
    }
  }

  async ensureBranch(branchName: string): Promise<void> {
    const exists = await this.branchExists(branchName);
    if (!exists) {
      await this.createBranch(branchName);
    } else {
      await this.switchBranch(branchName);
    }
  }
}
