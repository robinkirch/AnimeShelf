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
