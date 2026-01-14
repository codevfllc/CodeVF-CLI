type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
};

function normalizeVersion(version: string): number[] | null {
  const cleaned = version.trim().replace(/^v/, '').split('-')[0];
  if (!cleaned) return null;
  const parts = cleaned.split('.').map((segment) => Number(segment));
  if (parts.some((part) => Number.isNaN(part))) return null;
  return parts;
}

function compareSemver(current: string, latest: string): number | null {
  const currentParts = normalizeVersion(current);
  const latestParts = normalizeVersion(latest);
  if (!currentParts || !latestParts) return null;

  const length = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < length; i += 1) {
    const a = currentParts[i] ?? 0;
    const b = latestParts[i] ?? 0;
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return 0;
}

export async function checkForUpdates(options: {
  packageName?: string;
  currentVersion: string;
  timeoutMs?: number;
}): Promise<UpdateCheckResult | null> {
  if (process.env.CODEVF_DISABLE_UPDATE_CHECK) {
    return null;
  }

  const packageName = options.packageName ?? 'codevf';
  const currentVersion = options.currentVersion;
  const timeoutMs = options.timeoutMs ?? 1500;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/package/${packageName}/dist-tags`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      }
    );

    if (!response.ok) return null;
    const data = (await response.json()) as { latest?: string };
    if (!data.latest || typeof data.latest !== 'string') return null;

    const comparison = compareSemver(currentVersion, data.latest);
    if (comparison === null) return null;

    return {
      currentVersion,
      latestVersion: data.latest,
      isOutdated: comparison === -1,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
