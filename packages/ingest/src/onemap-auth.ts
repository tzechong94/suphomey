const TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
/** Renew this long before expiry, so a token never lapses between being read and being used. */
const RENEW_BEFORE_MS = 10 * 60 * 1000;

type Credentials = { email?: string; password?: string };

/**
 * OneMap access tokens expire 72 hours after issue. Given the OneMap account's
 * email and password, this requests a token on first use and requests a new one
 * whenever the current one is within RENEW_BEFORE_MS of its expiry_timestamp,
 * so a long build never sends an expired token. Without credentials it returns
 * undefined and calls go out unauthenticated (allowed, but heavily rate limited).
 */
export function oneMapTokenProvider(
  { email, password }: Credentials = { email: process.env.ONEMAP_API_EMAIL, password: process.env.ONEMAP_API_PASSWORD },
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): () => Promise<string | undefined> {
  let current: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (!email || !password) return undefined;
    if (current && now() < current.expiresAt - RENEW_BEFORE_MS) return current.token;
    const res = await fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`OneMap token request failed: ${res.status} ${await res.text()}`);
    // expiry_timestamp is Unix seconds, sent as a string.
    const body = (await res.json()) as { access_token?: string; expiry_timestamp?: string };
    const expiresAt = Number(body.expiry_timestamp) * 1000;
    if (!body.access_token || !Number.isFinite(expiresAt)) throw new Error('OneMap token response missing access_token or expiry_timestamp');
    current = { token: body.access_token, expiresAt };
    return current.token;
  };
}
