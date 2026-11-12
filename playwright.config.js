'use strict';

const { defineConfig } = require('@playwright/test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

// Separa anche i dati generali di Firefox dal profilo personale su macOS.
const firefoxEnvironment = process.platform === 'darwin' ? {
  ...process.env,
  MOZ_APP_DATA: mkdtempSync(join(tmpdir(), 'unifilari-firefox-data-')),
  MOZ_LOCAL_APP_DATA: mkdtempSync(join(tmpdir(), 'unifilari-firefox-cache-')),
} : undefined;
if (firefoxEnvironment) process.once('exit', () => {
  rmSync(firefoxEnvironment.MOZ_APP_DATA, { recursive: true, force: true });
  rmSync(firefoxEnvironment.MOZ_LOCAL_APP_DATA, { recursive: true, force: true });
});

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'browser.test.js',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'firefox', use: { browserName: 'firefox', launchOptions: { env: firefoxEnvironment } } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'python3 -m http.server 4175 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    stderr: 'ignore',
  },
});
