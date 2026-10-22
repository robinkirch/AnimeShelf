import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('./logger', () => ({ rendererLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

type JikanModule = typeof import('./jikanApi');

let api: JikanModule;
let get: Mock;
/** Start time (fake clock) and URL of every HTTP request. */
let calls: Array<{ at: number; url: string; params?: Record<string, unknown> }>;

const httpError = (status: number | undefined, headers: Record<string, string> = {}) =>
  Object.assign(new Error(status ? `HTTP ${status}` : 'Network Error'), status ? { response: { status, headers } } : {});
const anime = (mal_id: number) => ({ mal_id, title: `Anime ${mal_id}` });

beforeEach(async () => {
  // The queue, rate limiter and cache are module state: load a fresh module for every test.
  vi.resetModules();
  vi.useFakeTimers();
  api = await import('./jikanApi');
  get = (await import('axios')).default.get as Mock;
  calls = [];
  get.mockImplementation(async (url: string, config: { params?: Record<string, unknown> }) => {
    calls.push({ at: Date.now(), url, params: config.params });
    return { status: 200, data: { data: anime(Number(url.split('/').pop()) || 1) } };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('jikanApi queue', () => {
  it('caches responses', async () => {
    await api.jikanApi.getAnimeById(5);
    await api.jikanApi.getAnimeById(5);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('merges identical concurrent requests', async () => {
    const [a, b] = await Promise.all([api.jikanApi.getAnimeById(7), api.jikanApi.getAnimeById(7)]);
    expect(a).toEqual(b);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps at least 300 ms between requests', async () => {
    const all = Promise.all([1, 2, 3].map(id => api.jikanApi.getAnimeById(id)));
    await vi.advanceTimersByTimeAsync(1000);
    await all;
    expect(calls).toHaveLength(3);
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(300);
    expect(calls[2].at - calls[1].at).toBeGreaterThanOrEqual(300);
  });

  it('serves high priority requests before queued low priority ones', async () => {
    const low = [1, 2, 3].map(id => api.jikanApi.getAnimeById(id, { priority: 'low' }));
    const high = api.jikanApi.searchAnime('frieren');
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all([...low, high]);
    expect(calls.map(c => c.url.replace(/^.*\/v1/, ''))).toEqual(['/anime/1', '/anime', '/anime/2', '/anime/3']);
  });

  it('removes aborted requests that have not started', async () => {
    const first = api.jikanApi.getAnimeById(1);
    const controller = new AbortController();
    const second = api.jikanApi.getAnimeById(2, { signal: controller.signal });
    const secondError = second.catch((error: unknown) => error);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);
    await first;
    expect(await secondError).toMatchObject({ name: 'AbortError' });
    expect(calls.map(c => c.url)).toEqual([expect.stringMatching(/\/anime\/1$/)]);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(api.jikanApi.getAnimeRelations(1, { signal: controller.signal })).rejects.toSatisfy(api.isAbortError);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('jikanApi errors and retries', () => {
  it('retries 429 after Retry-After', async () => {
    get.mockRejectedValueOnce(httpError(429, { 'retry-after': '2' }));
    const result = api.jikanApi.getAnimeRelations(1);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBeDefined();
    expect(calls).toHaveLength(1); // the failed attempt is not recorded by the mock implementation
    expect(get).toHaveBeenCalledTimes(2);
    expect(calls[0].at).toBeGreaterThanOrEqual(2000);
  });

  it('gives up after 4 retries with exponential backoff', async () => {
    get.mockRejectedValue(httpError(undefined));
    const result = api.jikanApi.getAnimeRelations(1);
    const error = result.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 1000);
    expect(await error).toMatchObject({ name: 'JikanApiError', code: 'failed' });
    expect(get).toHaveBeenCalledTimes(5);
  });

  it.each([
    [403, 'blocked'],
    [404, 'failed'],
  ])('does not retry HTTP %i (code %s)', async (status, code) => {
    get.mockRejectedValue(httpError(status));
    await expect(api.jikanApi.getAnimeRelations(1)).rejects.toMatchObject({ code, status });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reports exhausted rate limits as rateLimit', async () => {
    get.mockRejectedValue(httpError(429, { 'retry-after': '1' }));
    const result = api.jikanApi.searchAnime('x');
    const error = result.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await error).toMatchObject({ code: 'rateLimit' });
  });

  it('getAnimeById returns null instead of throwing', async () => {
    get.mockRejectedValue(httpError(404));
    await expect(api.jikanApi.getAnimeById(1)).resolves.toBeNull();
  });
});

describe('season lists', () => {
  it('loads all pages and removes duplicates', async () => {
    get.mockImplementation(async (url: string, config: { params: { page: number } }) => {
      calls.push({ at: Date.now(), url, params: config.params });
      const page = config.params.page;
      return {
        status: 200,
        data: {
          data: page === 1 ? [anime(1), anime(2)] : [anime(2), anime(3)],
          pagination: { has_next_page: page < 2 },
        },
      };
    });
    const result = api.jikanApi.getSeason(2026, 'fall');
    await vi.advanceTimersByTimeAsync(1000);
    expect((await result).map(a => a.mal_id)).toEqual([1, 2, 3]);
    expect(calls.map(c => c.params?.page)).toEqual([1, 2]);
    expect(calls[0].url).toMatch(/\/seasons\/2026\/fall$/);
  });
});
