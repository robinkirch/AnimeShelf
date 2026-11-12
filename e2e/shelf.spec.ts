import { completeProfileSetup, expect, test } from './fixtures';
import { FRIEREN, SERIES } from './mockApis';
import { en } from '../src/i18n/messages/en';

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, name) => values[name]);

test('search, add to shelf, track progress and remove, persisted in the test database', async ({ launchApp }) => {
  const title = FRIEREN.title;

  // 1) Search (Tenrai is mocked) and add with the default status "Plan to Watch".
  const first = await launchApp();
  await completeProfileSetup(first.window);
  await first.window.getByPlaceholder(en.search.standardPlaceholder).fill('frieren');
  await first.window.getByRole('button', { name: en.search.searchButton, exact: true }).click();
  await expect(first.window.getByText(title).first()).toBeVisible();
  await first.window.getByRole('button', { name: en.anime.addToShelf }).first().click();

  const addDialog = first.window.getByRole('dialog', { name: fill(en.anime.addDialog.title, { title }) });
  await addDialog.getByRole('button', { name: en.anime.addToShelf }).click();
  await expect(addDialog).toBeHidden();
  await expect(first.window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeHidden();
  expect(first.apiLog.some(entry => entry.includes('api.tenrai.org/v1/anime?') && entry.includes('q=frieren'))).toBe(true);
  await first.app.close();

  // 2) After a restart the entry comes from the test database; count two episodes.
  const second = await launchApp();
  const episodeInput = second.window.getByLabel(fill(en.anime.currentEpisodeFor, { title }));
  await expect(episodeInput).toHaveValue('0');
  const increment = second.window.getByRole('button', { name: fill(en.anime.incrementEpisode, { title }) });
  await increment.click();
  await expect(episodeInput).toHaveValue('1');
  await increment.click();
  await expect(episodeInput).toHaveValue('2');

  // Watched episodes show up in the statistics.
  await second.window.getByRole('link', { name: en.layout.nav.stats }).click();
  await expect(second.window).toHaveURL(/\/stats$/);
  await expect(second.window.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(second.window.getByText(en.stats.emptyTitle)).toBeHidden();
  await second.app.close();

  // 3) Progress survived the restart; remove the entry again.
  const third = await launchApp();
  await expect(third.window.getByLabel(fill(en.anime.currentEpisodeFor, { title }))).toHaveValue('2');
  await third.window.getByRole('button', { name: en.anime.removeFromShelf }).click();
  await expect(third.window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeVisible();
  await third.app.close();

  const fourth = await launchApp();
  await expect(fourth.window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeVisible();
});

test('"Add entire series" dialog scrolls through a long series', async ({ launchApp }) => {
  const { window } = await launchApp();
  await completeProfileSetup(window);
  await window.getByPlaceholder(en.search.standardPlaceholder).fill('series season 1');
  await window.getByRole('button', { name: en.search.searchButton, exact: true }).click();
  await window.getByRole('button', { name: en.anime.addEntireSeries }).click();

  const dialog = window.getByRole('dialog', { name: fill(en.anime.addAllDialog.title, { title: SERIES[0].title }) });
  const lastSeason = dialog.getByRole('heading', { name: SERIES.at(-1)!.title });
  await expect(lastSeason).toBeAttached();
  await expect(lastSeason).not.toBeInViewport();

  // Scroll with the mouse wheel inside the list, as a user would.
  await dialog.getByRole('heading', { name: SERIES[0].title, exact: true }).hover();
  await window.mouse.wheel(0, 5000);
  await expect(lastSeason).toBeInViewport();
  await expect(dialog.getByRole('button', { name: en.anime.addAllDialog.submit })).toBeInViewport();
});
