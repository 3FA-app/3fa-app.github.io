// Shape of the release manifest published to S3 by scripts/release/publish.mjs
// at `releases/latest.json`. The website reads it to render download links.

export type Platform = 'macos' | 'windows' | 'linux';

export interface PlatformAsset {
  /** Public URL of the zip (binary + installer). */
  url: string;
  /** Byte size, for display. */
  size: number;
  /** SHA-256 hex of the zip, for integrity verification. */
  sha256: string;
  /** Filename, e.g. 3fa-0.1.0-macos-aarch64.zip */
  filename: string;
}

export interface ReleaseManifest {
  version: string;
  releasedAt: string;
  notes?: string;
  assets: Partial<Record<Platform, PlatformAsset>>;
}

const RELEASES_BASE =
  import.meta.env.PUBLIC_RELEASES_URL ?? 'https://downloads.threefa.app';

/** Fetch the latest release manifest at build time. Falls back to an empty
 *  manifest so the site still builds before the first release is published. */
export async function getLatestRelease(): Promise<ReleaseManifest> {
  try {
    const res = await fetch(`${RELEASES_BASE}/releases/latest.json`);
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    return (await res.json()) as ReleaseManifest;
  } catch {
    return { version: '0.0.0', releasedAt: '', assets: {} };
  }
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

export function humanSize(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
