import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { run, capture } from './shell.js';

/**
 * Backs up Homebrew packages to a Brewfile in dest/homebrew/.
 * Only top-level formulae (brew leaves), casks, and taps are included —
 * transitive dependencies are intentionally excluded so the restored
 * environment stays minimal and correct.
 * @param {string} dest - Destination directory for the backup.
 * @returns {Promise<void>}
 */
export async function backupBrew(dest) {
  const brewDir = join(dest, 'homebrew');
  mkdirSync(brewDir, { recursive: true });

  const [tapsOut, leavesOut, casksOut] = await Promise.all([
    capture('brew', ['tap']),
    capture('brew', ['leaves']),
    capture('brew', ['list', '--cask']),
  ]);

  const taps = tapsOut.split('\n').map(l => l.trim()).filter(Boolean);
  const formulae = leavesOut.split('\n').map(l => l.trim()).filter(Boolean);
  const casks = casksOut.split('\n').map(l => l.trim()).filter(Boolean);

  const lines = [
    ...taps.map(t => `tap "${t}"`),
    ...formulae.map(f => `brew "${f}"`),
    ...casks.map(c => `cask "${c}"`),
  ];

  writeFileSync(join(brewDir, 'Brewfile'), lines.join('\n') + '\n');
}

/**
 * Restores Homebrew packages from a Brewfile in dest/homebrew/.
 * @param {string} dest - Destination directory that contains the backup.
 * @returns {Promise<void>}
 */
export async function restoreBrew(dest) {
  const brewfile = join(dest, 'homebrew', 'Brewfile');
  if (!existsSync(brewfile)) {
    throw new Error(`No Brewfile found at ${brewfile}. Run backup first.`);
  }
  await run('brew', ['bundle', 'install', `--file=${brewfile}`]);
}
