
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import type { UserAnime, EpisodeWatchEvent, UserProfile } from '../src/types/anime'; // Changed from '@/types/anime'

const dbPath = path.join(app.getPath('userData'), 'animeshelf.sqlite3');
let db: Database.Database;

export function initDb() {
  db = new Database(dbPath);
  console.log(`Database opened at ${dbPath}`);

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS anime_shelf (
      mal_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      cover_image TEXT,
      total_episodes INTEGER,
      user_status TEXT NOT NULL,
      current_episode INTEGER NOT NULL DEFAULT 0,
      user_rating INTEGER,
      genres TEXT,
      studios TEXT,
      type TEXT,
      year INTEGER,
      season TEXT,
      streaming_platforms TEXT,
      broadcast_day TEXT,
      duration_minutes INTEGER
    );

    CREATE TABLE IF NOT EXISTS episode_watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mal_id INTEGER NOT NULL,
      episode_number_watched INTEGER NOT NULL,
      watched_at TEXT NOT NULL,
      FOREIGN KEY (mal_id) REFERENCES anime_shelf(mal_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ignored_preview_mal_ids (
      mal_id INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1, -- Ensures only one row for profile
      username TEXT,
      profile_picture_data_uri TEXT,
      profile_setup_complete INTEGER DEFAULT 0 -- 0 for false, 1 for true
    );
  `);
  console.log('Tables checked/created.');

  // Ensure a default profile row exists
  const profileRow = db.prepare('SELECT id FROM user_profile WHERE id = 1').get();
  if (!profileRow) {
    db.prepare('INSERT INTO user_profile (id, username, profile_picture_data_uri, profile_setup_complete) VALUES (1, NULL, NULL, 0)').run();
    console.log('Default user profile row created.');
  }
}

export function closeDb() {
  if (db) {
    db.close();
    console.log('Database connection closed.');
  }
}

// Helper to parse JSON array fields
function parseJsonArray(jsonString: string | null | undefined): string[] {
  if (!jsonString) return [];
  try {
    const arr = JSON.parse(jsonString);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// Anime Shelf CRUD
export function getShelf(): UserAnime[] {
  const stmt = db.prepare('SELECT * FROM anime_shelf');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    ...row,
    genres: parseJsonArray(row.genres),
    studios: parseJsonArray(row.studios),
    streaming_platforms: parseJsonArray(row.streaming_platforms),
  }));
}

export function addAnimeToShelf(anime: UserAnime): void {
  const stmt = db.prepare(`
    INSERT INTO anime_shelf (
      mal_id, title, cover_image, total_episodes, user_status, current_episode, 
      user_rating, genres, studios, type, year, season, streaming_platforms, broadcast_day, duration_minutes
    ) VALUES (
      @mal_id, @title, @cover_image, @total_episodes, @user_status, @current_episode,
      @user_rating, @genres, @studios, @type, @year, @season, @streaming_platforms, @broadcast_day, @duration_minutes
    )
  `);
  stmt.run({
    ...anime,
    genres: JSON.stringify(anime.genres || []),
    studios: JSON.stringify(anime.studios || []),
    streaming_platforms: JSON.stringify(anime.streaming_platforms || []),
  });
}

export function updateAnimeOnShelf(mal_id: number, updates: Partial<UserAnime>): void {
  const existing = db.prepare('SELECT * FROM anime_shelf WHERE mal_id = ?').get(mal_id) as UserAnime | undefined;
  if (!existing) {
    console.warn(`Attempted to update non-existent anime with mal_id: ${mal_id}`);
    return; 
  }

  const fields = Object.keys(updates).filter(key => key !== 'mal_id');
  if (fields.length === 0) return;

  const setClause = fields.map(field => `${field} = @${field}`).join(', ');
  const stmt = db.prepare(`UPDATE anime_shelf SET ${setClause} WHERE mal_id = @mal_id`);
  
  const params: any = { mal_id };
  for (const key of fields) {
    const typedKey = key as keyof UserAnime;
    if (typedKey === 'genres' || typedKey === 'studios' || typedKey === 'streaming_platforms') {
      params[key] = JSON.stringify(updates[typedKey] || []);
    } else {
      params[key] = updates[typedKey];
    }
  }
  stmt.run(params);
}

export function removeAnimeFromShelf(mal_id: number): void {
  db.prepare('DELETE FROM episode_watch_history WHERE mal_id = ?').run(mal_id); 
  db.prepare('DELETE FROM anime_shelf WHERE mal_id = ?').run(mal_id);
}

// Episode Watch History
export function getEpisodeWatchHistory(): EpisodeWatchEvent[] {
  const stmt = db.prepare('SELECT mal_id, episode_number_watched, watched_at FROM episode_watch_history');
  return stmt.all() as EpisodeWatchEvent[];
}

export function addEpisodeWatchEvents(events: EpisodeWatchEvent[]): void {
  const stmt = db.prepare('INSERT INTO episode_watch_history (mal_id, episode_number_watched, watched_at) VALUES (@mal_id, @episode_number_watched, @watched_at)');
  db.transaction((evts: EpisodeWatchEvent[]) => {
    for (const event of evts) stmt.run(event);
  })(events);
}

// Ignored Preview MAL IDs
export function getIgnoredPreviewMalIds(): number[] {
  const stmt = db.prepare('SELECT mal_id FROM ignored_preview_mal_ids');
  const rows = stmt.all() as { mal_id: number }[];
  return rows.map(row => row.mal_id);
}

export function addIgnoredPreviewMalId(mal_id: number): void {
  db.prepare('INSERT OR IGNORE INTO ignored_preview_mal_ids (mal_id) VALUES (?)').run(mal_id);
}

export function removeIgnoredPreviewMalId(mal_id: number): void {
  db.prepare('DELETE FROM ignored_preview_mal_ids WHERE mal_id = ?').run(mal_id);
}

// Batch Import
export function importAnimeBatch(animeList: UserAnime[]): { successCount: number; errors: Array<{ animeTitle?: string; malId?: number; error: string }> } {
    let successCount = 0;
    const errors: Array<{ animeTitle?: string; malId?: number; error: string }> = [];

    const insertStmt = db.prepare(`
        INSERT INTO anime_shelf (
        mal_id, title, cover_image, total_episodes, user_status, current_episode, 
        user_rating, genres, studios, type, year, season, streaming_platforms, broadcast_day, duration_minutes
        ) VALUES (
        @mal_id, @title, @cover_image, @total_episodes, @user_status, @current_episode,
        @user_rating, @genres, @studios, @type, @year, @season, @streaming_platforms, @broadcast_day, @duration_minutes
        )
    `);

    const updateStmt = db.prepare(`
        UPDATE anime_shelf SET 
        title = @title, cover_image = @cover_image, total_episodes = @total_episodes, 
        user_status = @user_status, current_episode = @current_episode, user_rating = @user_rating, 
        genres = @genres, studios = @studios, type = @type, year = @year, season = @season, 
        streaming_platforms = @streaming_platforms, broadcast_day = @broadcast_day, duration_minutes = @duration_minutes
        WHERE mal_id = @mal_id
    `);
    
    const findStmt = db.prepare('SELECT mal_id FROM anime_shelf WHERE mal_id = ?');

    db.transaction(() => {
        for (const anime of animeList) {
            try {
                const params = {
                    ...anime,
                    genres: JSON.stringify(anime.genres || []),
                    studios: JSON.stringify(anime.studios || []),
                    streaming_platforms: JSON.stringify(anime.streaming_platforms || []),
                };
                const exists = findStmt.get(anime.mal_id);
                if (exists) {
                    updateStmt.run(params);
                } else {
                    insertStmt.run(params);
                }
                successCount++;
            } catch (error: any) {
                 errors.push({ malId: anime.mal_id, animeTitle: anime.title, error: error.message || "SQLite error during batch import." });
            }
        }
    })();

    return { successCount, errors };
}

// User Profile
export function getUserProfile(): UserProfile | null {
  const row = db.prepare('SELECT username, profile_picture_data_uri, profile_setup_complete FROM user_profile WHERE id = 1').get() as any;
  if (row) {
    return {
      username: row.username,
      profilePictureDataUri: row.profile_picture_data_uri,
      profileSetupComplete: Boolean(row.profile_setup_complete),
    };
  }
  return null; // Should ideally not happen due to initDb ensuring row exists
}

export function updateUserProfile(profile: Partial<UserProfile>): void {
  const fields = Object.keys(profile) as Array<keyof UserProfile>;
  if (fields.length === 0) return;

  const fieldToColumnMapping: Partial<Record<keyof UserProfile, string>> = {
    username: 'username',
    profilePictureDataUri: 'profile_picture_data_uri',
    profileSetupComplete: 'profile_setup_complete',
  };

  const setClauses: string[] = [];
  const params: any = {};

  for (const field of fields) {
    const columnName = fieldToColumnMapping[field];
    if (columnName) {
      // Use original JS field name for param binding placeholder in SQL (e.g., @profilePictureDataUri)
      // And use original JS field name for the key in the params object
      setClauses.push(`${columnName} = @${field}`); 
      
      if (field === 'profileSetupComplete') {
        params[field] = profile[field] ? 1 : 0;
      } else {
        params[field] = profile[field];
      }
    }
  }

  if (setClauses.length === 0) {
    console.warn("updateUserProfile: No valid fields to update after mapping.", profile);
    return;
  }
  
  const stmt = db.prepare(`UPDATE user_profile SET ${setClauses.join(', ')} WHERE id = 1`);
  try {
    stmt.run(params);
  } catch (error) {
    console.error("Error updating user profile in DB:", error, "Query:", `UPDATE user_profile SET ${setClauses.join(', ')} WHERE id = 1`, "Params:", params);
    // Optionally re-throw or handle as needed
  }
}

