/** A release asset may be rendered only after its URL and metadata agree. */
export interface VerifiedReleaseAsset {
  url: string;
  filename: string;
  size: number;
  sha256: string;
}

const SAFE_ZIP_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/u;
const SHA256_HEX = /^[0-9a-f]{64}$/u;

/** Reject ambiguous or incomplete release metadata before producing links. */
export function isValidReleaseAsset(
  input: unknown,
  releasesBase: string,
): input is VerifiedReleaseAsset {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return false;
  const asset = input as Record<string, unknown>;
  if (typeof asset.filename !== 'string' || !SAFE_ZIP_NAME.test(asset.filename)) return false;
  if (!Number.isSafeInteger(asset.size) || (asset.size as number) <= 0) return false;
  if (typeof asset.sha256 !== 'string' || !SHA256_HEX.test(asset.sha256)) return false;
  if (typeof asset.url !== 'string') return false;

  try {
    const base = new URL(releasesBase);
    const url = new URL(asset.url);
    return (
      base.protocol === 'https:' &&
      url.protocol === 'https:' &&
      url.origin === base.origin &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === '' &&
      url.pathname.split('/').at(-1) === asset.filename
    );
  } catch {
    return false;
  }
}
