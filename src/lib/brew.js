import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { run } from './shell.js';

/**
 * Backs up Homebrew packages to a Brewfile in dest/homebrew/.
 * @param {string} dest - Destination directory for the backup.
 * @returns {Promise<void>}
 */
export async function backupBrew(dest) {
  const brewDir = join(dest, 'homebrew');
  mkdirSync(brewDir, { recursive: true });
  const brewFile = join(brewDir, 'Brewfile');
  await run('brew', ['bundle', 'dump', '--force', '--no-vscode', `--file=${brewFile}`]);
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
