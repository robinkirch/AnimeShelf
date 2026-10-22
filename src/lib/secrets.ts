// Secrets such as AI API keys. In the Electron app they are encrypted by the operating system via
// safeStorage in the main process and stored in SQLite; the renderer only reads/writes them over IPC.
// Without Electron (plain browser via `npm run dev`) they are kept in memory only, never in plain-text storage.

const memorySecrets = new Map<string, string>();

function electronStore() {
  return typeof window !== 'undefined' ? window.electronStore : undefined;
}

/** Earlier versions stored API keys in plain text in localStorage; move them once into encrypted storage. */
async function migrateLegacyValue(name: string): Promise<string | null> {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(name);
  } catch {
    return null;
  }
  if (!legacy) return null;
  const store = electronStore();
  if (!store) return legacy;
  try {
    await store.setSecret(name, legacy);
    localStorage.removeItem(name);
  } catch (error) {
    // Keep the legacy value if it could not be stored encrypted, so the key is not lost.
    console.error(`Could not migrate "${name}" to encrypted storage:`, error);
  }
  return legacy;
}

export async function getSecret(name: string): Promise<string | null> {
  const store = electronStore();
  if (!store) return memorySecrets.get(name) ?? null;
  const migrated = await migrateLegacyValue(name);
  if (migrated !== null) return migrated;
  return store.getSecret(name);
}

/** An empty value deletes the secret. Throws if the system cannot encrypt (the value is then not stored). */
export async function setSecret(name: string, value: string): Promise<void> {
  const store = electronStore();
  if (!store) {
    if (value) memorySecrets.set(name, value);
    else memorySecrets.delete(name);
    return;
  }
  await store.setSecret(name, value);
}
