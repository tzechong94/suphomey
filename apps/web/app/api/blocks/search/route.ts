import { getDb, searchBlocks } from '@suphomey/db';
import { z } from 'zod';
import { blockLabel, titleCase } from '@/lib/format';
import { handler, json, parseQuery } from '@/lib/http';

const Query = z.object({ q: z.string().trim().min(2, 'type at least 2 characters').max(80) });

export const GET = handler(async (request: Request) => {
  const { q } = parseQuery(request, Query);
  const rows = await searchBlocks(getDb(), q);
  return json(rows.map((r) => ({ id: r.id, label: blockLabel(r.block, r.street), town: titleCase(r.town), postal: r.postal })));
});
