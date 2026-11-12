import type { BrowserContext, Route } from '@playwright/test';
import type { JikanAnime } from '../src/types/anime';

// 1x1 PNG, so covers render without loading images from the internet.
const COVER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function fixtureAnime(mal_id: number, title: string, overrides: Partial<JikanAnime> = {}): JikanAnime {
  return {
    mal_id,
    url: `https://myanimelist.net/anime/${mal_id}`,
    images: { jpg: { image_url: COVER, small_image_url: COVER, large_image_url: COVER }, webp: { image_url: COVER, small_image_url: COVER, large_image_url: COVER } },
    approved: true,
    titles: [{ type: 'Default', title }],
    title,
    type: 'TV',
    episodes: 12,
    status: 'Finished Airing',
    airing: false,
    duration: '24 min per ep',
    score: 8.5,
    scored_by: 1000,
    synopsis: `Synopsis of ${title}.`,
    season: 'fall',
    year: 2023,
    producers: [],
    licensors: [],
    studios: [{ mal_id: 11, type: 'anime', name: 'Test Studio', url: '' }],
    genres: [{ mal_id: 2, type: 'anime', name: 'Adventure', url: '' }],
    ...overrides,
  } as JikanAnime;
}

export const FRIEREN = fixtureAnime(52991, 'Sousou no Frieren', { episodes: 28 });
export const SEASON_ANIME = fixtureAnime(60001, 'E2E Airing Show', { status: 'Currently Airing', airing: true, year: 2026, season: 'fall' });
export const UPCOMING_ANIME = fixtureAnime(60002, 'E2E Upcoming Show', { status: 'Not yet aired', episodes: null, year: 2027, season: 'winter' });

// A franchise with six seasons, so "Add entire series" has a long list. The dialog only lists direct
// prequels/sequels, so season 1 links to all later seasons.
export const SERIES = Array.from({ length: 6 }, (_, i) => fixtureAnime(70001 + i, `E2E Series Season ${i + 1}`, { year: 2015 + i }));
const relationEntry = (anime: JikanAnime) => ({ mal_id: anime.mal_id, type: 'anime', name: anime.title, url: '' });
const SERIES_RELATIONS = new Map(SERIES.map((anime, i) => [anime.mal_id, i === 0
  ? [{ relation: 'Sequel', entry: SERIES.slice(1).map(relationEntry) }]
  : [{ relation: 'Prequel', entry: [relationEntry(SERIES[0])] }],
]));

const ANIME_BY_ID = new Map([FRIEREN, SEASON_ANIME, UPCOMING_ANIME, ...SERIES].map(anime => [anime.mal_id, anime]));
const singlePage = (data: unknown[]) => ({ data, pagination: { last_visible_page: 1, has_next_page: false } });

/** Requests to external hosts that reached the mocks, e.g. to assert which API calls the app made. */
export type ApiLog = string[];

/**
 * Answers Tenrai (Jikan v4 format) and AniList with fixtures and blocks every other external request.
 * Must be installed before the app page is opened.
 */
export async function mockExternalApis(context: BrowserContext): Promise<ApiLog> {
  const log: ApiLog = [];
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

  await context.route(url => !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http'), async route => {
    const url = new URL(route.request().url());
    log.push(`${route.request().method()} ${url.hostname}${url.pathname}${url.search}`);

    if (url.hostname === 'graphql.anilist.co') {
      return json(route, { data: { Page: { media: [] } } });
    }
    if (url.hostname === 'api.tenrai.org') {
      const path = url.pathname.replace(/^\/v1/, '');
      if (path === '/anime') {
        const query = (url.searchParams.get('q') ?? '').toLowerCase();
        return json(route, singlePage([...ANIME_BY_ID.values()].filter(anime => anime.title.toLowerCase().includes(query))));
      }
      if (path === '/seasons/now') return json(route, singlePage([SEASON_ANIME]));
      if (path === '/seasons/upcoming') return json(route, singlePage([UPCOMING_ANIME]));
      if (path.startsWith('/seasons/')) return json(route, singlePage([SEASON_ANIME]));

      const relations = path.match(/^\/anime\/(\d+)\/relations$/);
      if (relations) return json(route, { data: SERIES_RELATIONS.get(Number(relations[1])) ?? [] });

      const byId = path.match(/^\/anime\/(\d+)$/);
      const anime = byId && ANIME_BY_ID.get(Number(byId[1]));
      if (anime) return json(route, { data: anime });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"status":404}' });
    }
    // Anything else (fonts, analytics, unknown APIs) must not leave the test.
    return route.abort('blockedbyclient');
  });
  return log;
}
