import { DATASETS, type DatasetKey } from '../datasets';
import { downloadToDir } from '../download';
import { RAW_DIR } from '../paths';

// Usage: pnpm download [key ...]   (no keys = every dataset)
const requested = process.argv.slice(2) as DatasetKey[];
const unknown = requested.filter((k) => !(k in DATASETS));
if (unknown.length) {
  console.error(`Unknown dataset(s): ${unknown.join(', ')}. Known: ${Object.keys(DATASETS).join(', ')}`);
  process.exit(1);
}

await downloadToDir(requested.length ? requested : (Object.keys(DATASETS) as DatasetKey[]), RAW_DIR);
