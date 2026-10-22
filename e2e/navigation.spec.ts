import { createRequire } from 'node:module';
import { completeProfileSetup, expect, test } from './fixtures';
import { SEASON_ANIME } from './mockApis';
import { en } from '../src/i18n/messages/en';
import { de } from '../src/i18n/messages/de';

test('all pages open without errors', async ({ launchApp }) => {
  const { window } = await launchApp();
  const pageErrors: string[] = [];
  window.on('pageerror', error => pageErrors.push(error.message));
  await completeProfileSetup(window);

  const nav = (name: string) => window.getByRole('link', { name, exact: false });

  await nav(en.layout.nav.seasonal).click();
  await expect(window).toHaveURL(/\/seasonal$/);
  await expect(window.getByText(SEASON_ANIME.title).first()).toBeVisible();

  await nav(en.layout.nav.preview).click();
  await expect(window).toHaveURL(/\/preview$/);
  await expect(window.getByRole('heading', { name: en.preview.emptyShelfTitle })).toBeVisible();

  await nav(en.layout.nav.stats).click();
  await expect(window).toHaveURL(/\/stats$/);
  await expect(window.getByText(en.stats.emptyTitle)).toBeVisible();

  await nav(en.layout.nav.shelf).click();
  await expect(window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('settings dialog opens and switches the language', async ({ launchApp }) => {
  const { window } = await launchApp();
  await completeProfileSetup(window);

  await window.getByRole('button', { name: en.layout.openSettings }).click();
  const settings = window.getByRole('dialog', { name: en.settings.title });
  await expect(settings).toBeVisible();
  await settings.getByRole('combobox', { name: en.settings.language.label }).click();
  await window.getByRole('option', { name: 'Deutsch' }).click();

  // Applied immediately, also inside the open dialog.
  const settingsDe = window.getByRole('dialog', { name: de.settings.title });
  await expect(settingsDe).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(settingsDe).toBeHidden();
  await expect(window.getByRole('link', { name: de.layout.nav.seasonal })).toBeVisible();
});

test('settings show the app version; updates are off outside the installed app', async ({ launchApp }) => {
  const { window } = await launchApp();
  await completeProfileSetup(window);
  const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

  await window.getByRole('button', { name: en.layout.openSettings }).click();
  const settings = window.getByRole('dialog', { name: en.settings.title });
  await expect(settings.getByText(en.updates.currentVersion.replace('{version}', version))).toBeVisible();
  await expect(settings.getByRole('status').filter({ hasText: en.updates.disabled })).toBeVisible();
  await expect(settings.getByRole('button', { name: en.updates.check })).toBeDisabled();
});
