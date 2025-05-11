
import { z } from 'zod';

export const JikanMALItemSchema = z.object({
  mal_id: z.number().describe("The MyAnimeList ID of the item."),
  type: z.string().describe("The type of the item (e.g., 'anime', 'manga', 'genre', 'studio')."),
  name: z.string().describe("The name of the item."),
  url: z.string().describe("The URL to the item's page on MyAnimeList."),
});

export const JikanImageSetSchema = z.object({
  image_url: z.string().describe("Standard image URL."),
  small_image_url: z.string().optional().nullable().describe("Small image URL."),
  large_image_url: z.string().optional().nullable().describe("Large image URL."),
});

export const JikanImagesSchema = z.object({
  jpg: JikanImageSetSchema.describe("JPEG image URLs."),
  webp: JikanImageSetSchema.describe("WebP image URLs."),
});

export const JikanTitleSchema = z.object({
  type: z.string().describe("The type of title (e.g., 'Default', 'English', 'Japanese')."),
  title: z.string().describe("The title string."),
});

export const JikanAiredPropSchema = z.object({
    from: z.object({ 
        day: z.number().nullable().describe("Day of the month."), 
        month: z.number().nullable().describe("Month of the year."), 
        year: z.number().nullable().describe("Year.") 
    }).describe("Start date components."),
    to: z.object({ 
        day: z.number().nullable().describe("Day of the month."), 
        month: z.number().nullable().describe("Month of the year."), 
        year: z.number().nullable().describe("Year.") 
    }).describe("End date components."),
    string: z.string().describe("Full airing period as a string."),
}).describe("Airing date properties.");


export const JikanAiredSchema = z.object({
  from: z.string().nullable().describe("Start date in ISO 8601 format."),
  to: z.string().nullable().describe("End date in ISO 8601 format."),
  prop: JikanAiredPropSchema,
}).describe("Airing period information.");

export const JikanBroadcastSchema = z.object({
  day: z.string().nullable().describe("Day of the week broadcasted."),
  time: z.string().nullable().describe("Time of broadcast."),
  timezone: z.string().nullable().describe("Timezone of broadcast."),
  string: z.string().nullable().describe("Full broadcast string."),
}).describe("Broadcast information.");

export const JikanTrailerImagesSchema = z.object({
    image_url: z.string().nullable().optional().describe("Standard image URL for the trailer thumbnail."),
    small_image_url: z.string().nullable().optional().describe("Small image URL for the trailer thumbnail."),
    medium_image_url: z.string().nullable().optional().describe("Medium image URL for the trailer thumbnail."),
    large_image_url: z.string().nullable().optional().describe("Large image URL for the trailer thumbnail."),
    maximum_image_url: z.string().nullable().optional().describe("Maximum resolution image URL for the trailer thumbnail."),
}).describe("Image thumbnails for the trailer.");

export const JikanTrailerSchema = z.object({
    youtube_id: z.string().nullable().optional().describe("YouTube video ID for the trailer."),
    url: z.string().nullable().optional().describe("URL to the trailer video."),
    embed_url: z.string().nullable().optional().describe("Embed URL for the trailer video."),
    images: JikanTrailerImagesSchema.optional().nullable().describe("Image thumbnails for the trailer."),
}).describe("Trailer information.");


export const JikanAnimeSchema = z.object({
  mal_id: z.number().describe("The MyAnimeList ID of the anime."),
  url: z.string().describe("The URL to the anime's page on MyAnimeList."),
  images: JikanImagesSchema.describe("Various image URLs for the anime."),
  trailer: JikanTrailerSchema.optional().nullable().describe("Trailer information for the anime."),
  approved: z.boolean().describe("Whether the anime entry is approved by MyAnimeList moderators."),
  titles: z.array(JikanTitleSchema).describe("Different titles for the anime (e.g., Default, English, Japanese)."),
  title: z.string().describe("The primary, default title of the anime."),
  title_english: z.string().optional().nullable().describe("The English title of the anime."),
  title_japanese: z.string().optional().nullable().describe("The Japanese title of the anime."),
  title_synonyms: z.array(z.string()).optional().describe("Synonymous titles for the anime."),
  type: z.string().optional().nullable().describe("The type of anime (e.g., TV, Movie, OVA, ONA, Special, Music)."),
  source: z.string().optional().nullable().describe("The source material of the anime (e.g., Manga, Original, Light novel)."),
  episodes: z.number().nullable().describe("The number of episodes. Null if unknown or not applicable (e.g., for movies)."),
  status: z.string().describe("The airing status of the anime (e.g., 'Finished Airing', 'Currently Airing', 'Not yet aired')."),
  airing: z.boolean().describe("Boolean indicating if the anime is currently airing."),
  aired: JikanAiredSchema.optional().nullable().describe("Airing dates and period information."),
  duration: z.string().optional().describe("The duration per episode (e.g., '24 min per ep')."),
  rating: z.string().optional().nullable().describe("The age rating of the anime (e.g., 'PG-13 - Teens 13 or older', 'R - 17+ (violence & profanity)')."),
  score: z.number().nullable().describe("The score of the anime on MyAnimeList, out of 10."),
  scored_by: z.number().nullable().describe("The number of users who scored the anime."),
  rank: z.number().nullable().optional().describe("The rank of the anime on MyAnimeList based on score. Null if not ranked."),
  popularity: z.number().nullable().optional().describe("The popularity rank of the anime on MyAnimeList."),
  members: z.number().nullable().optional().describe("The number of MyAnimeList members who have this anime in their list."),
  favorites: z.number().nullable().optional().describe("The number of MyAnimeList users who favorited this anime."),
  synopsis: z.string().nullable().describe("A brief synopsis or description of the anime."),
  background: z.string().optional().nullable().describe("Background information about the anime's production or source material."),
  season: z.string().optional().nullable().describe("The season the anime premiered (e.g., 'summer', 'winter'). Null if not applicable or unknown."),
  year: z.number().nullable().optional().describe("The year the anime premiered. Null if not applicable or unknown."),
  broadcast: JikanBroadcastSchema.optional().nullable().describe("Broadcast day, time, and timezone information for TV series."),
  producers: z.array(JikanMALItemSchema).describe("List of producers involved in the anime."),
  licensors: z.array(JikanMALItemSchema).describe("List of licensors for the anime."),
  studios: z.array(JikanMALItemSchema).describe("List of animation studios that animated the anime."),
  genres: z.array(JikanMALItemSchema).describe("List of genres associated with the anime."),
  explicit_genres: z.array(JikanMALItemSchema).optional().describe("List of explicit genres (e.g., 'Hentai')."),
  themes: z.array(JikanMALItemSchema).optional().describe("List of themes present in the anime (e.g., 'Mecha', 'School')."),
  demographics: z.array(JikanMALItemSchema).optional().describe("List of target demographics for the anime (e.g., 'Shounen', 'Shoujo')."),
  // Note: 'relations' field is omitted here as it's complex and typically fetched separately if needed.
  // This schema is primarily for representing a single anime's core data as returned by search or by ID.
});

// This can be used in TypeScript code where JikanAnime type is expected.
export type JikanAnimeZod = z.infer<typeof JikanAnimeSchema>;
