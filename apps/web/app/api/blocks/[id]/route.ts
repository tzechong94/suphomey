import { getDb } from '@suphomey/db';
import { handler, idParam, json, notFound } from '@/lib/http';
import { getBlockProfile } from '@/lib/server/block-profile';

export const GET = handler(async (_request: Request, ctx: RouteContext<'/api/blocks/[id]'>) => {
  const id = idParam.safeParse((await ctx.params).id);
  if (!id.success) throw notFound('Block');
  const profile = await getBlockProfile(getDb(), id.data);
  if (!profile) throw notFound('Block');
  return json(profile);
});
