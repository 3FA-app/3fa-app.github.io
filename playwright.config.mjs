import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.E2E_BASE_URL;

// NOT Astro's default 4321. The suite previously bound there with
// `reuseExistingServer: true`, which meant that any other project's dev server
// already listening on 4321 would be adopted and tested instead of this site —
// the run stayed green while asserting against somebody else's HTML. A distinct
// default port plus no server reuse keeps the run hermetic.
const PORT = Number(process.env.E2E_PORT ?? 4329);
const baseURL = externalBaseURL ?? `http://127.0.0.1:${PORT}`;

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',

  // Fail the build if a `.only` is committed, and tolerate genuine flake in CI
  // only — never locally, where a retry would mask a real regression.
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,

  // A hung page must not hang the whole pipeline.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // `list` for readable CI logs; the HTML report is what gets uploaded as a
  // build artifact when a run fails.
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    // Artifacts for post-mortem debugging of a CI failure. `on-first-retry`
    // keeps the happy path fast while still capturing anything that flakes.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: `npm run preview -- --host 127.0.0.1 --port ${PORT}`,
          url: baseURL,
          // Deliberately false: see the note on PORT above. If the port is busy
          // the run fails loudly instead of testing an unrelated server.
          reuseExistingServer: false,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }),
});
