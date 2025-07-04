import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
const dbPath = path.join(app.getPath('userData'), 'animeshelf.sqlite3');
let db;
export function initDb() {
    if (db) {
        console.log("Database already initialized, skipping.");
        return;
    }
    console.log("Attempting to initialize database at:", dbPath);
    db = new Database(dbPath);
    console.log(`Database opened at ${dbPath}`);
    try {
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
    catch (error) {
        console.error("Error during database initialization in database.ts:", error); // NEU
        throw error; // Wichtig: Fehler weitergeben, damit sie im main.ts gefangen werden können
    }
}
export function closeDb() {
    if (db) {
        db.close();
        console.log('Database connection closed.');
    }
}
// Helper to parse JSON array fields
function parseJsonArray(jsonString) {
    if (!jsonString)
        return [];
    try {
        const arr = JSON.parse(jsonString);
        return Array.isArray(arr) ? arr : [];
    }
    catch (e) {
        return [];
    }
}
// Anime Shelf CRUD
export function getShelf() {
    const stmt = db.prepare('SELECT * FROM anime_shelf');
    const rows = stmt.all();
    return rows.map(row => ({
        ...row,
        genres: parseJsonArray(row.genres),
        studios: parseJsonArray(row.studios),
        streaming_platforms: parseJsonArray(row.streaming_platforms),
    }));
}
export function addAnimeToShelf(anime) {
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
export function updateAnimeOnShelf(mal_id, updates) {
    const existing = db.prepare('SELECT * FROM anime_shelf WHERE mal_id = ?').get(mal_id);
    if (!existing) {
        console.warn(`Attempted to update non-existent anime with mal_id: ${mal_id}`);
        return;
    }
    const fields = Object.keys(updates).filter(key => key !== 'mal_id');
    if (fields.length === 0)
        return;
    const setClause = fields.map(field => `${field} = @${field}`).join(', ');
    const stmt = db.prepare(`UPDATE anime_shelf SET ${setClause} WHERE mal_id = @mal_id`);
    const params = { mal_id };
    for (const key of fields) {
        const typedKey = key;
        if (typedKey === 'genres' || typedKey === 'studios' || typedKey === 'streaming_platforms') {
            params[key] = JSON.stringify(updates[typedKey] || []);
        }
        else {
            params[key] = updates[typedKey];
        }
    }
    stmt.run(params);
}
export function removeAnimeFromShelf(mal_id) {
    db.prepare('DELETE FROM episode_watch_history WHERE mal_id = ?').run(mal_id);
    db.prepare('DELETE FROM anime_shelf WHERE mal_id = ?').run(mal_id);
}
// Episode Watch History
export function getEpisodeWatchHistory() {
    const stmt = db.prepare('SELECT mal_id, episode_number_watched, watched_at FROM episode_watch_history');
    return stmt.all();
}
export function addEpisodeWatchEvents(events) {
    const stmt = db.prepare('INSERT INTO episode_watch_history (mal_id, episode_number_watched, watched_at) VALUES (@mal_id, @episode_number_watched, @watched_at)');
    db.transaction((evts) => {
        for (const event of evts)
            stmt.run(event);
    })(events);
}
// Ignored Preview MAL IDs
export function getIgnoredPreviewMalIds() {
    const stmt = db.prepare('SELECT mal_id FROM ignored_preview_mal_ids');
    const rows = stmt.all();
    return rows.map(row => row.mal_id);
}
export function addIgnoredPreviewMalId(mal_id) {
    db.prepare('INSERT OR IGNORE INTO ignored_preview_mal_ids (mal_id) VALUES (?)').run(mal_id);
}
export function removeIgnoredPreviewMalId(mal_id) {
    db.prepare('DELETE FROM ignored_preview_mal_ids WHERE mal_id = ?').run(mal_id);
}
// Batch Import
export function importAnimeBatch(animeList) {
    console.log("ImportAnimeBatch called with:", animeList.length, "items.");
    let successCount = 0;
    const errors = [];
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
                    console.log(`Updated new anime: ${anime.title}`);
                    updateStmt.run(params);
                }
                else {
                    console.log(`Inserted new anime: ${anime.title}`);
                    insertStmt.run(params);
                }
                successCount++;
            }
            catch (error) {
                console.error(`Error processing anime ${anime.title} (MAL ID: ${anime.mal_id}):`, error);
                errors.push({ malId: anime.mal_id, animeTitle: anime.title, error: error.message || "SQLite error during batch import." });
            }
        }
    })();
    console.log(`Import finished. Success: ${successCount}, Errors: ${errors.length}`);
    return { successCount, errors };
}
// User Profile
export function getUserProfile() {
    const row = db.prepare('SELECT username, profile_picture_data_uri, profile_setup_complete FROM user_profile WHERE id = 1').get();
    if (row) {
        return {
            username: row.username,
            profilePictureDataUri: row.profile_picture_data_uri,
            profileSetupComplete: Boolean(row.profile_setup_complete),
        };
    }
    return null; // Should ideally not happen due to initDb ensuring row exists
}
export function updateUserProfile(profile) {
    const fields = Object.keys(profile);
    if (fields.length === 0)
        return;
    const fieldToColumnMapping = {
        username: 'username',
        profilePictureDataUri: 'profile_picture_data_uri',
        profileSetupComplete: 'profile_setup_complete',
    };
    const setClauses = [];
    const params = {};
    for (const field of fields) {
        const columnName = fieldToColumnMapping[field];
        if (columnName) {
            // Use original JS field name for param binding placeholder in SQL (e.g., @profilePictureDataUri)
            // And use original JS field name for the key in the params object
            setClauses.push(`${columnName} = @${field}`);
            if (field === 'profileSetupComplete') {
                params[field] = profile[field] ? 1 : 0;
            }
            else {
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
    }
    catch (error) {
        console.error("Error updating user profile in DB:", error, "Query:", `UPDATE user_profile SET ${setClauses.join(', ')} WHERE id = 1`, "Params:", params);
        // Optionally re-throw or handle as needed
    }
}
//# sourceMappingURL=database.js.map