import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { completeProfileSetup, expect, test } from './fixtures';
import { FRIEREN } from './mockApis';
import { en } from '../src/i18n/messages/en';
import type { AnimeShelfBackup } from '../src/lib/backup';

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));

test('backup export contains shelf, watch history and ignored entries; import restores them', async ({ launchApp }) => {
  const title = FRIEREN.title;

  // 1) Create data: add Frieren, watch two episodes, ignore one preview entry.
  const source = await launchApp();
  await completeProfileSetup(source.window);
  await source.window.getByPlaceholder(en.search.standardPlaceholder).fill('frieren');
  await source.window.getByRole('button', { name: en.search.searchButton, exact: true }).click();
  await source.window.getByRole('button', { name: en.anime.addToShelf }).first().click();
  await source.window.getByRole('dialog').getByRole('button', { name: en.anime.addToShelf }).click();
  const increment = source.window.getByRole('button', { name: fill(en.anime.incrementEpisode, { title }) }).first();
  await increment.click();
  await increment.click();
  await expect(source.window.getByLabel(fill(en.anime.currentEpisodeFor, { title })).first()).toHaveValue('2');
  await source.window.evaluate(() => window.electronStore!.addIgnoredPreviewMalId(60002));
  await source.window.reload();

  // 2) Export via Settings → Data Management.
  await source.window.getByRole('button', { name: en.layout.openSettings }).click();
  await source.window.getByRole('button', { name: en.settings.data.open }).click();
  await source.window.getByRole('button', { name: en.io.modal.exportData }).click();
  // Electron asks where to save downloads; in the test the main process saves straight into a temp folder.
  const dir = mkdtempSync(path.join(tmpdir(), 'animeshelf-backup-'));
  await source.app.evaluate(({ session }, targetDir) => {
    session.defaultSession.once('will-download', (_event, item) => item.setSavePath(`${targetDir}/${item.getFilename()}`));
  }, dir);
  await source.window.getByRole('button', { name: en.io.export.button }).click();

  try {
    await expect.poll(() => readdirSync(dir).filter(name => !name.endsWith('.crdownload'))).toHaveLength(1);
    const fileName = readdirSync(dir)[0];
    expect(fileName).toMatch(/^animeshelf_backup_\d{4}-\d{2}-\d{2}\.json$/);
    const file = path.join(dir, fileName);
    const backup = JSON.parse(readFileSync(file, 'utf8')) as AnimeShelfBackup;
    expect(backup.format).toBe('animeshelf-backup');
    expect(backup.shelf.map(a => [a.mal_id, a.current_episode])).toEqual([[FRIEREN.mal_id, 2]]);
    expect(backup.watchHistory.map(e => e.episode_number_watched).sort()).toEqual([1, 2]);
    expect(backup.ignoredPreview).toEqual([{ mal_id: 60002 }]);

    // 3) Wipe the data (fresh database) and import the file again.
    await source.window.evaluate(id => window.electronStore!.removeAnimeFromShelf(id), FRIEREN.mal_id);
    await source.window.evaluate(() => window.electronStore!.removeIgnoredPreviewMalId(60002));
    await source.window.reload();
    await expect(source.window.getByRole('heading', { name: en.shelf.emptyTitle })).toBeVisible();

    await source.window.getByRole('button', { name: en.layout.openSettings }).click();
    await source.window.getByRole('button', { name: en.settings.data.open }).click();
    await source.window.getByRole('button', { name: en.io.modal.importData }).click();
    await source.window.getByLabel(en.io.import.selectFile).setInputFiles(file);
    await source.window.getByRole('button', { name: en.io.import.button, exact: true }).click();
    await source.window.getByRole('button', { name: en.io.import.modeDialog.overwrite }).click();
    await expect(source.window.getByText(fill(en.io.import.backupHistory, { added: 2, skipped: 0 }))).toBeVisible();

    // Importing the same file again adds nothing twice.
    await source.window.getByLabel(en.io.import.selectFile).setInputFiles(file);
    await source.window.getByRole('button', { name: en.io.import.button, exact: true }).click();
    await source.window.getByRole('button', { name: en.io.import.modeDialog.extend }).click();
    await expect(source.window.getByText(fill(en.io.import.backupHistory, { added: 0, skipped: 2 }))).toBeVisible();

    const restored = await source.window.evaluate(async () => ({
      shelf: (await window.electronStore!.getShelf()).map(a => [a.mal_id, a.current_episode]),
      history: (await window.electronStore!.getEpisodeWatchHistory()).length,
      ignored: await window.electronStore!.getIgnoredPreviewMalIds(),
    }));
    expect(restored).toEqual({ shelf: [[FRIEREN.mal_id, 2]], history: 2, ignored: [60002] });

    // 4) Local change, then "extend" keeps it and "overwrite" takes the value from the file. Nothing is deleted.
    await source.window.evaluate(id => window.electronStore!.updateAnimeOnShelf(id, { current_episode: 5 }), FRIEREN.mal_id);
    const importWith = async (mode: string) => {
      await source.window.getByLabel(en.io.import.selectFile).setInputFiles(file);
      await source.window.getByRole('button', { name: en.io.import.button, exact: true }).click();
      await source.window.getByRole('button', { name: mode }).click();
    };
    const episodeInDb = () => source.window.evaluate(async () => (await window.electronStore!.getShelf())[0].current_episode);

    await importWith(en.io.import.modeDialog.extend);
    await expect(source.window.getByText(fill(en.io.import.skippedExisting.one, { count: 1 }))).toBeVisible();
    expect(await episodeInDb()).toBe(5);

    await importWith(en.io.import.modeDialog.overwrite);
    await expect.poll(episodeInDb).toBe(2);
    const after = await source.window.evaluate(async () => ({
      shelf: (await window.electronStore!.getShelf()).length,
      history: (await window.electronStore!.getEpisodeWatchHistory()).length,
      ignored: (await window.electronStore!.getIgnoredPreviewMalIds()).length,
    }));
    expect(after).toEqual({ shelf: 1, history: 2, ignored: 1 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
