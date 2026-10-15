import { getDb, getMapBlocks } from '@suphomey/db';
import { blockLabel } from '@/lib/format';
import { handler, json } from '@/lib/http';
import { encodeMapPayload } from '@/lib/map-data';

/** Every located block, in a compact columnar format, for the map and client-side scoring. */
export const GET = handler(async () => {
  const rows = await getMapBlocks(getDb());
  return json(encodeMapPayload(rows.map((r) => ({ ...r, label: blockLabel(r.block, r.street) }))));
});
