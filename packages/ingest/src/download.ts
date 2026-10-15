import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATASETS, type DatasetKey } from './datasets';

const POLL_URL = (id: string) => `https://api-open.data.gov.sg/v1/public/api/datasets/${id}/poll-download`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * data.gov.sg serves files through a two-step flow: poll-download returns a
 * short-lived signed S3 URL, which is then fetched. Unauthenticated callers are
 * rate limited (HTTP 429), so failures back off and retry.
 */
export async function fetchDataset(key: DatasetKey, attempts = 6): Promise<Buffer> {
  const { id } = DATASETS[key];
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const poll = await fetch(POLL_URL(id));
      if (!poll.ok) throw new Error(`poll-download ${poll.status}`);
      const body = (await poll.json()) as { code: number; data?: { url?: string }; errorMsg?: string };
      const url = body.data?.url;
      if (!url) throw new Error(`poll-download returned no url: ${body.errorMsg ?? body.code}`);
      const file = await fetch(url);
      if (!file.ok) throw new Error(`download ${file.status}`);
      return Buffer.from(await file.arrayBuffer());
    } catch (err) {
      lastError = err;
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error(`Failed to download ${key} (${id}): ${String(lastError)}`);
}

export async function downloadToDir(keys: DatasetKey[], dir: string, log = console.log): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const key of keys) {
    const buf = await fetchDataset(key);
    await writeFile(path.join(dir, DATASETS[key].file), buf);
    log(`${key}: ${(buf.length / 1e6).toFixed(1)} MB`);
  }
}
