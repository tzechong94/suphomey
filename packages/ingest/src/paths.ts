import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Raw downloads (gitignored) and the committed, processed snapshot. */
export const RAW_DIR = path.join(repoRoot, 'data/raw');
export const SEED_DIR = path.join(repoRoot, 'data/seed');
