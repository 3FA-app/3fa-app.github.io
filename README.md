# 3FA website

Astro static marketing site with per-OS download buttons.

The build requires Node.js 22.12 or newer (the Astro 7 runtime floor).

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

The canonical production release origin is `https://downloads.threefa.app`: a
CloudFront HTTPS distribution in front of the `threefa-releases` S3 bucket. Both
the Pages deployment and the scheduled release monitor pin that origin
explicitly. This is the reviewed architecture boundary, not evidence that the
external DNS, certificate, distribution, bucket, or release objects have been
provisioned.

Local and pull-request builds retain the fail-safe behavior: if no manifest is
available, the site still builds and shows "coming soon." Production Pages
deployment is stricter. It runs `npm run test:releases-origin` after the build
and refuses to deploy unless public DNS/TLS works and `latest.json` contains
complete macOS, Windows, and Linux assets with positive sizes, full SHA-256
digests, and same-origin HTTPS URLs.

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
- **Audited Astro runtime:** Astro 7 with the compatible sitemap integration;
  the production dependency graph has no known vulnerabilities.
- **No inline style attributes:** component styles are compiled into hashed style
  blocks covered by the generated CSP. Prism is configured for future Markdown
  code blocks because Astro 7's default Shiki output uses CSP-hostile inline styles.

Re-run the enforced production audit with `npm run audit:prod`.
