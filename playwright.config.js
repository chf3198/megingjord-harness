// Playwright config — devenv-ops dashboard E2E tests
// Refs #3166: only collect @playwright/test specs; node:test specs
// run via split-test-runner.js to prevent cross-framework pollution.
const { defineConfig } = require('@playwright/test');
const {
  nodeTestIgnoreList,
} = require('./scripts/global/split-test-runner-ignore');

module.exports = defineConfig({
  testDir: './tests',
  testIgnore: nodeTestIgnoreList(),
  timeout: 30000,
  retries: 1,
  workers: 2,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8090',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 960, height: 1080 },
  },
  webServer: {
    command: 'node scripts/dashboard-server.js',
    port: 8090,
    reuseExistingServer: true,
    timeout: 10000,
  },
});
