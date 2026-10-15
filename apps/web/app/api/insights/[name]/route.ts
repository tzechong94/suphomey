import { getDb, INSIGHTS, type InsightName } from '@suphomey/db';
import { handler, json, notFound } from '@/lib/http';

export const GET = handler(async (_request: Request, ctx: RouteContext<'/api/insights/[name]'>) => {
  const { name } = await ctx.params;
  if (!Object.hasOwn(INSIGHTS, name)) throw notFound('Insight');
  return json(await INSIGHTS[name as InsightName](getDb()));
});
