import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import ignore from 'ignore';

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  'coverage/',
  '.codevf/',
  '*.log',
  '.env',
  '.env.local',
  '.DS_Store',
  'Thumbs.db',
];

export async function createRepoZip(cwd: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // Load .gitignore patterns
    const ig = ignore().add(DEFAULT_IGNORE_PATTERNS);
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    }

    // Add files to archive
    const addDirectory = (dirPath: string, basePath: string = '') => {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const relativePath = path.join(basePath, file);

        // Skip ignored files
        if (ig.ignores(relativePath)) {
          continue;
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          addDirectory(filePath, relativePath);
        } else if (stat.isFile()) {
          // Skip large files (> 10MB)
          if (stat.size > 10 * 1024 * 1024) {
            continue;
          }

          archive.file(filePath, { name: relativePath });
        }
      }
    };

    addDirectory(cwd);
    archive.finalize();
  });
}

export function shouldWarnAboutFile(filePath: string): boolean {
  const sensitivePatterns = [
    /\.env$/i,
    /\.env\./i,
    /credentials/i,
    /secret/i,
    /password/i,
    /auth\.json$/i,
    /id_rsa$/i,
    /\.pem$/i,
    /\.key$/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(filePath));
}
