import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Geocode } from './geocode';
import { SEED_DIR } from './paths';

const CACHE = path.join(SEED_DIR, 'onemap-cache.csv');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * File-backed cache of OneMap answers (hits and confirmed misses), committed to
 * the repo. Without a token OneMap rate limits aggressively, so calls are spaced
 * out and HTTP 429s back off exponentially.
 */
export class OneMapCache {
  private constructor(private readonly entries: Map<string, Geocode | null>) {}
  calls = 0;

  static async load(): Promise<OneMapCache> {
    const entries = new Map<string, Geocode | null>();
    if (existsSync(CACHE)) {
      for (const line of (await readFile(CACHE, 'utf8')).split('\n').slice(1)) {
        if (!line) continue;
        const [key, postal, lat, lng] = line.split(',');
        entries.set(key!, lat ? { key: key!, postal: postal!, lat: Number(lat), lng: Number(lng) } : null);
      }
    } else {
      await writeFile(CACHE, 'key,postal,lat,lng\n');
    }
    return new OneMapCache(entries);
  }

  async get(key: string, lookup: () => Promise<Geocode | null>): Promise<Geocode | null> {
    if (this.entries.has(key)) return this.entries.get(key)!;
    for (let attempt = 0; ; attempt++) {
      try {
        await sleep(1500);
        this.calls++;
        const result = await lookup();
        this.entries.set(key, result);
        await appendFile(CACHE, result ? `${key},${result.postal},${result.lat},${result.lng}\n` : `${key},,,\n`);
        return result;
      } catch (err) {
        if (attempt >= 6) throw err;
        await sleep(5000 * 2 ** attempt);
      }
    }
  }
}
