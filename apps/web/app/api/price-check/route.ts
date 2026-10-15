import { checkPrice, FLAT_TYPES } from '@suphomey/core';
import { getDb, getPriceSamples } from '@suphomey/db';
import { z } from 'zod';
import { handler, idParam, json, notFound, parseQuery } from '@/lib/http';

const Query = z.object({
  blockId: idParam,
  kind: z.enum(['rent', 'resale']),
  flatType: z.enum(FLAT_TYPES),
  amount: z.coerce.number().positive().max(10_000_000),
});

/** Where an asking rent or price sits among real transactions nearby. `result` is null when there is too little data. */
export const GET = handler(async (request: Request) => {
  const q = parseQuery(request, Query);
  const samples = await getPriceSamples(getDb(), q.blockId, q.kind, q.flatType);
  if (samples === null) throw notFound('Block');
  return json({ ...q, result: checkPrice(samples, q.amount) });
});
