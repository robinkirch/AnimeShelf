export interface JikanImageSet {
  image_url: string;
  small_image_url?: string;
  large_image_url?: string;
}

export interface JikanImages {
  jpg: JikanImageSet;
  webp: JikanImageSet;
}

export interface JikanTitle {
  type: string;
  title: string;
}

export interface JikanMALItem {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface JikanBroadcast {
  day: string | null;
  time: string | null;
  timezone: string | null;
  string: string | null;
}

export interface JikanAnime {
  mal_id: number;
  url: string;
  images: JikanImages;
  trailer?: { youtube_id: string | null; url: string | null; embed_url: string | null; images: { image_url: string | null; small_image_url: string | null; medium_image_url: string | null; large_image_url: string | null; maximum_image_url: string | null; } };
  approved: boolean;
  titles: JikanTitle[];
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  title_synonyms?: string[];
  type?: string | null; 
  source?: string | null;
  episodes: number | null;
  status: string; 
  airing: boolean;
  aired?: { from: string | null; to: string | null; prop: { from: { day: number | null; month: number | null; year: number | null; }; to: { day: number | null; month: number | null; year: number | null; }; string: string; }; };
  duration?: string;
  rating?: string | null; 
  score: number | null;
  scored_by: number | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
  favorites?: number | null;
  synopsis: string | null;
  background?: string | null;
  season?: string | null; 
  year?: number | null;
  broadcast?: JikanBroadcast;
  producers: JikanMALItem[];
  licensors: JikanMALItem[];
  studios: JikanMALItem[];
  genres: JikanMALItem[];
  explicit_genres?: JikanMALItem[];
  themes?: JikanMALItem[];
  demographics?: JikanMALItem[];
  relations?: JikanAnimeRelation[]; // Added for convenience, though API might provide separately
  streaming?: JikanMALItem[]; // Added field for streaming platforms
}

export type UserAnimeStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';

export const USER_ANIME_STATUS_OPTIONS: { value: UserAnimeStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'plan_to_watch', label: 'Plan to Watch' },
];

export const RATING_OPTIONS = [
    { value: 10, label: '10 (Masterpiece)'},
    { value: 9, label: '9 (Great)'},
    { value: 8, label: '8 (Very Good)'},
    { value: 7, label: '7 (Good)'},
    { value: 6, label: '6 (Fine)'},
    { value: 5, label: '5 (Average)'},
    { value: 4, label: '4 (Bad)'},
    { value: 3, label: '3 (Very Bad)'},
    { value: 2, label: '2 (Horrible)'},
    { value: 1, label: '1 (Appalling)'},
];

export const ANIME_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'TV', label: 'TV Series' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'Movie', label: 'Movie' },
  { value: 'Special', label: 'Special' },
  // { value: 'Music', label: 'Music' }, // Potentially too niche for default filter
];

// For statistics, we might want to consider all types
export const STATS_ANIME_TYPE_OPTIONS: { value: string; label: string }[] = [
  ...ANIME_TYPE_FILTER_OPTIONS,
  { value: 'Music', label: 'Music' },
  { value: 'Unknown', label: 'Unknown' }, // For items where type might be null
];


export const BROADCAST_DAY_OPTIONS: { value: string; label: string }[] = [
    { value: 'Mondays', label: 'Mondays' },
    { value: 'Tuesdays', label: 'Tuesdays' },
    { value: 'Wednesdays', label: 'Wednesdays' },
    { value: 'Thursdays', label: 'Thursdays' },
    { value: 'Fridays', label: 'Fridays' },
    { value: 'Saturdays', label: 'Saturdays' },
    { value: 'Sundays', label: 'Sundays' },
    { value: 'Other', label: 'Other/Unknown' },
];


export interface UserAnime {
  mal_id: number;
  title: string;
  cover_image: string;
  total_episodes: number | null;
  user_status: UserAnimeStatus;
  current_episode: number;
  user_rating: number | null; // 1-10 scale
  genres: string[]; 
  studios: string[];
  type: string | null;
  year: number | null;
  season: string | null;
  streaming_platforms: string[];
  broadcast_day: string | null;
  duration_minutes: number | null; // Duration per episode in minutes
}

export interface JikanAPISearchResponse {
  data: JikanAnime[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    }
  }
}
export interface JikanAPIByIdResponse {
  data: JikanAnime;
}

export interface JikanAPISeasonsResponse {
  data: JikanAnime[];
   pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  }
}

// Types for Anime Relations
export interface JikanAnimeRelationEntry {
  mal_id: number;
  type: string; // e.g., "anime", "manga"
  name: string;
  url: string;
}

export interface JikanAnimeRelation {
  relation: string; // e.g., "Sequel", "Prequel", "Alternative version"
  entry: JikanAnimeRelationEntry[];
}

export interface JikanAPIRelationsResponse {
  data: JikanAnimeRelation[];
}

// For tracking when an episode was watched
export interface EpisodeWatchEvent {
  mal_id: number;
  episode_number_watched: number; // The specific episode number that was watched
  watched_at: string; // ISO datetime string of when it was marked watched
}