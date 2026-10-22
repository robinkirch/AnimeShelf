import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn(), isCancel: vi.fn(() => false) } }));
vi.mock('./logger', () => ({ rendererLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

let api: typeof import('./anilistApi');
let post: Mock;

const edgesFor = (malId: number) => [{ relationType: 'SEQUEL', node: { idMal: malId + 1000 } }];

/** Answers like AniList: every requested MAL ID except the ones in `unknown` gets one relation. */
function answerBatches(unknown: number[] = []) {
  post.mockImplementation(async (_url: string, body: { variables: { ids: number[] } }) => ({
    data: {
      data: {
        Page: {
          media: body.variables.ids.map(id => ({ idMal: unknown.includes(id) ? null : id, relations: { edges: edgesFor(id) } })),
        },
      },
    },
  }));
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  api = await import('./anilistApi');
  post = (await import('axios')).default.post as Mock;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('anilistApi.getRelationsByMalIds', () => {
  it('fetches in batches of 50 and reports progress', async () => {
    answerBatches();
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const progress: Array<[number, number]> = [];
    const result = api.anilistApi.getRelationsByMalIds(ids, { onProgress: (done, total) => progress.push([done, total]) });
    await vi.advanceTimersByTimeAsync(5000);
    const map = await result;

    expect(post.mock.calls.map(call => call[1].variables.ids.length)).toEqual([50, 50, 20]);
    expect(progress).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]);
    expect(map.size).toBe(120);
    expect(map.get(7)).toEqual(edgesFor(7));
  });

  it('removes duplicate IDs and uses the cache on the next call', async () => {
    answerBatches();
    const first = api.anilistApi.getRelationsByMalIds([1, 1, 2]);
    await vi.advanceTimersByTimeAsync(1000);
    await first;
    expect(post.mock.calls[0][1].variables.ids).toEqual([1, 2]);

    const second = await api.anilistApi.getRelationsByMalIds([1, 2]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(second.size).toBe(2);
  });

  it('leaves out anime AniList does not know', async () => {
    answerBatches([2]);
    const result = api.anilistApi.getRelationsByMalIds([1, 2, 3]);
    await vi.advanceTimersByTimeAsync(1000);
    expect([...(await result).keys()]).toEqual([1, 3]);
  });

  it('throws on GraphQL errors without retrying', async () => {
    post.mockResolvedValue({ data: { errors: [{ message: 'Bad query' }] } });
    await expect(api.anilistApi.getRelationsByMalIds([1])).rejects.toMatchObject({ name: 'AniListApiError' });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('retries rate limits using Retry-After', async () => {
    post.mockRejectedValueOnce(Object.assign(new Error('HTTP 429'), { response: { status: 429, headers: { 'retry-after': '3' } } }));
    answerBatches();
    const result = api.anilistApi.getRelationsByMalIds([1]);
    await vi.advanceTimersByTimeAsync(2900);
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await result).size).toBe(1);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('stops with an AbortError when aborted between batches', async () => {
    answerBatches();
    const controller = new AbortController();
    const result = api.anilistApi.getRelationsByMalIds(Array.from({ length: 60 }, (_, i) => i + 1), {
      signal: controller.signal,
      onProgress: done => { if (done === 1) controller.abort(); },
    });
    const error = result.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await error).toMatchObject({ name: 'AbortError' });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
