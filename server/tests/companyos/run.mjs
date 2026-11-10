// Runs every Company OS API suite in sequence; works the same on Windows and Linux.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const suites = fs.readdirSync(dir).filter((name) => name.endsWith('.test.mjs')).sort();

for (const suite of suites) {
  console.log(`--- ${suite}`);
  const { status } = spawnSync(process.execPath, [path.join(dir, suite)], { stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}
