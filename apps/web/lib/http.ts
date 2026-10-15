import { z } from 'zod';

/**
 * Cache policy for read endpoints. The data changes at most daily, so the CDN
 * can serve a cached copy for an hour and keep serving it (while refreshing in
 * the background) for a day.
 */
export const CACHE = {
  hour: 'public, s-maxage=3600, stale-while-revalidate=86400',
  minute: 'public, s-maxage=60, stale-while-revalidate=60',
  none: 'no-store',
} as const;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);

export function json(data: unknown, cache: string = CACHE.hour, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': cache } });
}

/** Parses URL query parameters with a Zod schema; failures become a 400 with the reasons. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new HttpError(400, result.error.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`).join('; '));
  }
  return result.data;
}

/** Wraps a handler so expected errors become JSON responses and unexpected ones are logged as 500s. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, CACHE.none, err.status);
      console.error(err);
      return json({ error: 'Something went wrong on our side.' }, CACHE.none, 500);
    }
  };
}

export const idParam = z.coerce.number().int().positive();
