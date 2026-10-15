import { FLAT_TYPES } from '@suphomey/core';
import { getDb, getMonthlyMedians, getRecentRentals, getRecentResales } from '@suphomey/db';
import { z } from 'zod';
import { handler, idParam, json, notFound, parseQuery } from '@/lib/http';

const Query = z.object({
  kind: z.enum(['rent', 'resale']),
  flatType: z.enum(FLAT_TYPES).optional(),
});

/** Price history for one block: monthly medians for a flat type, plus the latest individual transactions. */
export const GET = handler(async (request: Request, ctx: RouteContext<'/api/blocks/[id]/transactions'>) => {
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) throw notFound('Block');
  const { kind, flatType } = parseQuery(request, Query);
  const db = getDb();
  const [series, recent] = await Promise.all([
    flatType ? getMonthlyMedians(db, id.data, kind, flatType) : Promise.resolve([]),
    kind === 'rent' ? getRecentRentals(db, id.data) : getRecentResales(db, id.data),
  ]);
  return json({ kind, flatType: flatType ?? null, series, recent });
});
