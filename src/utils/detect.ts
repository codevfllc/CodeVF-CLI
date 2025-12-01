import * as fs from 'fs';
import * as path from 'path';
import { ProjectType, ProjectDetection } from '../types/index.js';

export function detectProjectType(cwd: string = process.cwd()): ProjectDetection {
  const indicators: string[] = [];
  let type: ProjectType = 'unknown';
  let confidence = 0;

  // Check for Node.js project
  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    indicators.push('package.json');
    type = 'node';
    confidence = 90;
  }

  // Check for Python project
  if (
    fs.existsSync(path.join(cwd, 'requirements.txt')) ||
    fs.existsSync(path.join(cwd, 'setup.py')) ||
    fs.existsSync(path.join(cwd, 'pyproject.toml'))
  ) {
    indicators.push('requirements.txt or setup.py or pyproject.toml');
    type = 'python';
    confidence = 90;
  }

  // Check for Go project
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    indicators.push('go.mod');
    type = 'go';
    confidence = 95;
  }

  // Check for Ruby project
  if (fs.existsSync(path.join(cwd, 'Gemfile'))) {
    indicators.push('Gemfile');
    type = 'ruby';
    confidence = 90;
  }

  // Check for Java project
  if (
    fs.existsSync(path.join(cwd, 'pom.xml')) ||
    fs.existsSync(path.join(cwd, 'build.gradle'))
  ) {
    indicators.push('pom.xml or build.gradle');
    type = 'java';
    confidence = 90;
  }

  // Check for Rust project
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    indicators.push('Cargo.toml');
    type = 'rust';
    confidence = 95;
  }

  return {
    type,
    confidence,
    indicators,
    suggestedTestCommand: getSuggestedTestCommand(type),
    suggestedBuildCommand: getSuggestedBuildCommand(type),
  };
}

function getSuggestedTestCommand(type: ProjectType): string | undefined {
  const commands: Record<ProjectType, string | undefined> = {
    node: 'npm test',
    python: 'pytest',
    go: 'go test ./...',
    ruby: 'bundle exec rspec',
    java: 'mvn test',
    rust: 'cargo test',
    unknown: undefined,
  };

  return commands[type];
}

function getSuggestedBuildCommand(type: ProjectType): string | undefined {
  const commands: Record<ProjectType, string | undefined> = {
    node: 'npm run build',
    python: undefined,
    go: 'go build',
    ruby: undefined,
    java: 'mvn package',
    rust: 'cargo build --release',
    unknown: undefined,
  };

  return commands[type];
}
