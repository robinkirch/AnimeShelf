import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test as base, type ElectronApplication, type Page } from '@playwright/test';
import { mockExternalApis, type ApiLog } from './mockApis';
import { en } from '../src/i18n/messages/en';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_URL = 'http://localhost:9002';

export interface RunningApp {
  app: ElectronApplication;
  window: Page;
  apiLog: ApiLog;
}

interface Fixtures {
  /** Fresh data folder of this test (database, cookies, localStorage). Survives restarts within the test. */
  userDataDir: string;
  /** Starts the app with the test data folder; call again after `close()` to test a restart. */
  launchApp: (route?: string) => Promise<RunningApp>;
}

export const test = base.extend<Fixtures>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'animeshelf-e2e-'));
    await use(dir);
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  },

  launchApp: async ({ userDataDir }, use, testInfo) => {
    const started: RunningApp[] = [];

    await use(async (route = '/') => {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
      // Set by some tools (e.g. VS Code extensions); Electron would start as plain Node.
      delete env.ELECTRON_RUN_AS_NODE;
      Object.assign(env, { ANIMESHELF_USER_DATA: userDataDir, ANIMESHELF_E2E: '1', NODE_ENV: 'development' });

      const app = await electron.launch({ args: ['.'], cwd: projectRoot, env });
      const apiLog = await mockExternalApis(app.context());
      const window = await app.firstWindow();
      const running = { app, window, apiLog };
      started.push(running);

      // Guard: the app must use the test data folder, never the real one.
      const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
      expect(path.resolve(userData)).toBe(path.resolve(userDataDir));

      await window.goto(`${APP_URL}${route}`);
      return running;
    });

    for (const { app, window } of started) {
      if (testInfo.status !== testInfo.expectedStatus && !window.isClosed()) {
        await testInfo.attach('screenshot', { body: await window.screenshot(), contentType: 'image/png' }).catch(() => {});
      }
      await app.close().catch(() => {});
    }
  },
});

export { expect };

/** Completes the welcome dialog shown on the first start (fresh data folder). */
export async function completeProfileSetup(window: Page, username = 'E2E User') {
  const dialog = window.getByRole('dialog', { name: en.profileSetup.title });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(en.profileSetup.username).fill(username);
  await dialog.getByRole('button', { name: en.profileSetup.submit }).click();
  await expect(dialog).toBeHidden();
}
