import { z } from 'zod';
import { CACHE, handler, HttpError, json, parseQuery } from '@/lib/http';

const UPSTREAM = 'https://api.data.gov.sg/v1/transport/carpark-availability';

const Query = z.object({
  ids: z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^[A-Z0-9]{1,8}$/)).min(1).max(20)),
});

type Upstream = {
  items: {
    timestamp: string;
    carpark_data: { carpark_number: string; update_datetime: string; carpark_info: { lot_type: string; lots_available: string; total_lots: string }[] }[];
  }[];
};

/**
 * Live car lots (lot type "C") for up to 20 HDB carparks. The upstream feed
 * covers every carpark in one response, so it is fetched at most once a minute
 * per server and shared across requests.
 */
export const GET = handler(async (request: Request) => {
  const { ids } = parseQuery(request, Query);
  const res = await fetch(UPSTREAM, { next: { revalidate: 60 } });
  if (!res.ok) throw new HttpError(502, 'Live carpark data is unavailable right now.');
  const body = (await res.json()) as Upstream;
  const item = body.items[0];
  const wanted = new Set(ids);
  const carparks = (item?.carpark_data ?? [])
    .filter((c) => wanted.has(c.carpark_number))
    .map((c) => {
      const cars = c.carpark_info.find((i) => i.lot_type === 'C');
      return {
        carParkNo: c.carpark_number,
        available: cars ? Number(cars.lots_available) : null,
        total: cars ? Number(cars.total_lots) : null,
        updatedAt: c.update_datetime,
      };
    });
  return json({ timestamp: item?.timestamp ?? null, carparks }, CACHE.minute);
});
