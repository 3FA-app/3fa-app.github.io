import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site. Set PUBLIC_RELEASES_URL to the public base URL of the S3 bucket
// (or its CloudFront distribution) that serves the release manifest + zips,
// e.g. https://downloads.threefa.app  (which maps to s3://threefa-releases).
const RELEASES_URL =
  process.env.PUBLIC_RELEASES_URL || 'https://downloads.threefa.app';

export default defineConfig({
  site: process.env.SITE_URL || 'https://threefa.app',
  // Non-root base for project-style GitHub Pages hosting
  // (https://3fa-app.github.io/3fa-website). Root '/' everywhere else.
  base: process.env.BASE_PATH || '/',
  output: 'static',
  integrations: [sitemap()],

  // Content-Security-Policy. Astro injects a <meta http-equiv> CSP and computes
  // SHA-256 hashes for every bundled inline <script>/<style>, so we never need
  // 'unsafe-inline'. `script-src`/`style-src` are managed by Astro; we add the
  // remaining directives, including connecting to the releases origin (the only
  // external endpoint the client touches, for live manifest reads).
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data:",
        `connect-src 'self' ${RELEASES_URL}`,
      ],
    },
  },
});
