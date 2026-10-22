import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { completeProfileSetup, expect, test } from './fixtures';
import { en } from '../src/i18n/messages/en';
import { de } from '../src/i18n/messages/de';

test('first start: welcome dialog, empty shelf, no request leaves the mocks', async ({ launchApp }) => {
  const { window, apiLog } = await launchApp();

  await completeProfileSetup(window, 'Robin E2E');
  await expect(window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeVisible();
  expect(apiLog.filter(entry => !/api\.tenrai\.org|graphql\.anilist\.co/.test(entry))).toEqual([]);
});

test('language and profile survive a restart', async ({ launchApp }) => {
  const first = await launchApp();
  const dialog = first.window.getByRole('dialog', { name: en.profileSetup.title });
  await dialog.getByLabel(en.profileSetup.username).fill('Restart User');
  await dialog.getByRole('combobox', { name: en.settings.language.label }).click();
  await first.window.getByRole('option', { name: 'Deutsch' }).click();
  // The dialog switches to German immediately.
  await first.window.getByRole('button', { name: de.profileSetup.submit }).click();
  await expect(first.window.getByRole('heading', { name: de.shelf.emptyTitle })).toBeVisible();
  await first.app.close();

  const second = await launchApp();
  await expect(second.window.getByRole('heading', { name: de.shelf.emptyTitle })).toBeVisible();
  await expect(second.window.getByRole('dialog')).toBeHidden();
});

test('a second start with the same data folder exits and keeps the first window', async ({ launchApp, userDataDir }) => {
  const { window } = await launchApp();
  await completeProfileSetup(window);

  const electronPath = createRequire(import.meta.url)('electron') as unknown as string;
  const env: NodeJS.ProcessEnv = { ...process.env, ANIMESHELF_USER_DATA: userDataDir, ANIMESHELF_E2E: '1', NODE_ENV: 'development' };
  delete env.ELECTRON_RUN_AS_NODE;
  const second = spawn(electronPath, ['.'], { env, stdio: 'ignore' });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => { second.kill(); reject(new Error('Second instance did not exit')); }, 20_000);
    second.on('exit', code => { clearTimeout(timer); resolve(code); });
  });

  expect(exitCode).toBe(0);
  await expect(window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeVisible();
});
