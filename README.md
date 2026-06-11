# 3FA website

Astro static marketing site with per-OS download buttons.

```bash
npm install
npm run dev      # local dev
npm run build    # static build -> dist/
```

## How downloads work

At build time the site fetches the release manifest from S3
(`${PUBLIC_RELEASES_URL}/releases/latest.json`) and renders:

- a **primary button** that auto-detects the visitor's OS (client-side) and
  links to the matching zip, and
- explicit **macOS / Windows / Linux** buttons with size + SHA-256.

Set the manifest origin via env:

```bash
PUBLIC_RELEASES_URL=https://downloads.threefa.app  # S3/CloudFront base URL
SITE_URL=https://threefa.app
```

If no manifest is published yet, the site still builds and shows "coming soon".

Releases (the zips this site links to) are produced and uploaded from the
**frontend repo** (`3fa-desktop.rs/scripts/release/`, `package.sh` →
`publish.mjs`). This site only *reads* the resulting `latest.json` manifest.

## Security hardening

- **CSP:** Astro's `security.csp` emits a per-page `<meta http-equiv="content-security-policy">`
  with SHA-256 hashes for every inline script/style — no `unsafe-inline`.
  `connect-src` is scoped to `self` + `PUBLIC_RELEASES_URL`; `frame-ancestors`,
  `object-src` are locked down.
- **Transport headers:** [`public/_headers`](public/_headers) (Cloudflare Pages /
  Netlify format) adds HSTS (preload), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, COOP/COEP/CORP, and a restrictive `Permissions-Policy`.
- **Disclosure:** [`/.well-known/security.txt`](public/.well-known/security.txt) (RFC 9116)
  + a human [`/security`](src/pages/security.astro) policy page.
- **No third-party scripts**, no analytics, no external fonts — nothing to exfiltrate to.
- Dependencies audited: `npm audit` → 0 vulnerabilities (Astro 6).

Re-run the audit any time with `npm audit`.
