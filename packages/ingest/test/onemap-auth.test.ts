import { describe, expect, it } from 'vitest';
import { oneMapTokenProvider } from '../src/onemap-auth';

const HOUR = 60 * 60 * 1000;

/** Fake getToken endpoint: each call issues token-<n> valid for 72 hours from `clock`. */
function tokenServer(clock: { now: number }) {
  const requests: unknown[] = [];
  const fetcher = (async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    const expiry = Math.floor((clock.now + 72 * HOUR) / 1000);
    return Response.json({ access_token: `token-${requests.length}`, expiry_timestamp: String(expiry) });
  }) as typeof fetch;
  return { fetcher, requests };
}

describe('oneMapTokenProvider', () => {
  it('returns undefined without credentials, and makes no request', async () => {
    const clock = { now: 0 };
    const server = tokenServer(clock);
    expect(await oneMapTokenProvider({}, server.fetcher, () => clock.now)()).toBeUndefined();
    expect(server.requests).toHaveLength(0);
  });

  it('requests a token once and reuses it while it is still valid', async () => {
    const clock = { now: 0 };
    const server = tokenServer(clock);
    const token = oneMapTokenProvider({ email: 'me@example.com', password: 'secret123' }, server.fetcher, () => clock.now);
    expect(await token()).toBe('token-1');
    clock.now = 71 * HOUR;
    expect(await token()).toBe('token-1');
    expect(server.requests).toEqual([{ email: 'me@example.com', password: 'secret123' }]);
  });

  it('renews shortly before the 72 hour expiry', async () => {
    const clock = { now: 0 };
    const server = tokenServer(clock);
    const token = oneMapTokenProvider({ email: 'me@example.com', password: 'secret123' }, server.fetcher, () => clock.now);
    await token();
    clock.now = 72 * HOUR - 5 * 60 * 1000;
    expect(await token()).toBe('token-2');
  });

  it('surfaces a rejected login instead of continuing unauthenticated', async () => {
    const fetcher = (async () => Response.json({ error: 'User is not registered in system.' }, { status: 404 })) as unknown as typeof fetch;
    const token = oneMapTokenProvider({ email: 'me@example.com', password: 'secret123' }, fetcher);
    await expect(token()).rejects.toThrow('OneMap token request failed: 404');
  });
});
