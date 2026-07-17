import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: 'npm run preview -- --host 127.0.0.1 --port 4321',
          url: 'http://127.0.0.1:4321',
          reuseExistingServer: true,
          timeout: 120000,
        },
      }),
});
