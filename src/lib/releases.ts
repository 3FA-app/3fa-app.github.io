import { isValidReleaseAsset } from './release-validation';

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

export const RELEASES_BASE =
  import.meta.env.PUBLIC_RELEASES_URL ?? 'https://downloads.threefa.app';

/** The pinned releases origin (scheme + host), or '' if RELEASES_BASE is not a
 *  parseable URL. Exported so the client-side OS-detect script can enforce the
 *  same origin pin that `isAllowedDownloadUrl` enforces at build time. */
export function releasesOrigin(): string {
  try {
    return new URL(RELEASES_BASE).origin;
  } catch {
    return '';
  }
}

/** True only for an absolute https:// URL on the pinned releases origin. Guards
 *  against a tampered manifest pointing a download (or the auto-detect button's
 *  `href`) at an attacker origin or a `javascript:` URL. */
export function isAllowedDownloadUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const parsed = new URL(u);
    const base = new URL(RELEASES_BASE);
    return (
      parsed.protocol === 'https:' &&
      base.protocol === 'https:' &&
      parsed.origin === base.origin &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.search === '' &&
      parsed.hash === ''
    );
  } catch {
    return false;
  }
}

/** Accept only well-formed release manifests and independently verified assets.
 * Unknown platforms and unsafe/incomplete assets never reach rendered links. */
function sanitize(input: unknown): ReleaseManifest {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('release manifest must be an object');
  }
  const manifest = input as Record<string, unknown>;
  if (
    typeof manifest.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version) ||
    typeof manifest.releasedAt !== 'string' ||
    !Number.isFinite(Date.parse(manifest.releasedAt))
  ) {
    throw new Error('release manifest has invalid metadata');
  }
  if (
    manifest.assets === null ||
    typeof manifest.assets !== 'object' ||
    Array.isArray(manifest.assets)
  ) {
    throw new Error('release assets must be an object');
  }

  const provided = manifest.assets as Record<string, unknown>;
  const assets: ReleaseManifest['assets'] = {};
  for (const platform of ['macos', 'windows', 'linux'] as const) {
    if (isValidReleaseAsset(provided[platform], RELEASES_BASE)) {
      assets[platform] = provided[platform];
    }
  }
  return {
    version: manifest.version,
    releasedAt: manifest.releasedAt,
    notes: typeof manifest.notes === 'string' ? manifest.notes : undefined,
    assets,
  };
}

/** Fetch the latest release manifest at build time. Falls back to an empty
 *  manifest so the site still builds before the first release is published. */
export async function getLatestRelease(): Promise<ReleaseManifest> {
  try {
    const res = await fetch(`${RELEASES_BASE}/releases/latest.json`);
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    return sanitize(await res.json());
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
