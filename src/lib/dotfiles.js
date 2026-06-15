import fs from 'fs';
import path from 'path';
import { run, runShell } from './shell.js';

/**
 * Scans homeDir for dotfiles/directories, excluding .Trash and .Library*.
 *
 * @param {string} homeDir - The home directory to scan.
 * @returns {{ name: string, label: string, fileCount: number, sizeKb: number }[]}
 */
export function scanDotfiles(homeDir) {
  const entries = fs.readdirSync(homeDir, { withFileTypes: true });

  return entries
    .filter(
      (e) =>
        e.name.startsWith('.') &&
        e.name !== '.Trash' &&
        !e.name.startsWith('.Library')
    )
    .map((e) => {
      const fullPath = path.join(homeDir, e.name);
      let fileCount;
      let sizeKb;

      if (e.isDirectory()) {
        try {
          fileCount = fs.readdirSync(fullPath).length;
        } catch {
          fileCount = 0;
        }
        sizeKb = Math.round(fileCount * 2);
      } else {
        fileCount = 1;
        try {
          sizeKb = Math.round(fs.statSync(fullPath).size / 1024);
        } catch {
          sizeKb = 0;
        }
      }

      const label = `~/${e.name} (${fileCount} files, ${sizeKb} KB)`;
      return { name: e.name, label, fileCount, sizeKb };
    });
}

/**
 * Backs up selected dotfiles to dest/dotfiles/ using rsync.
 * Each path is rsynced individually so Ctrl+C on any one stops the whole operation.
 *
 * @param {string[]} paths   - Array of dotfile/dir names (e.g. ['.zshrc', '.ssh']).
 * @param {string}   homeDir - Source home directory.
 * @param {string}   dest    - Destination base directory.
 * @returns {Promise<void>}
 */
export async function backupDotfiles(paths, homeDir, dest) {
  const dotfilesDir = path.join(dest, 'dotfiles');
  fs.mkdirSync(dotfilesDir, { recursive: true });

  for (const name of paths) {
    const src = path.join(homeDir, name);
    const dst = dotfilesDir + '/';
    // -rlptgo: equivalent to -a minus -D (--devices --specials).
    // -D causes openrsync to try copying socket files (e.g. ~/.gnupg/S.gpg-agent)
    // which fails with "mkstempsock: Invalid argument" on cloud-synced destinations
    // like OneDrive that don't support special files.
    // stderr is piped away: rsync prints "skipping non-regular file" warnings for
    // remaining sockets/pipes; those are harmless and exit code stays 0.
    await run('rsync', ['-rlptgo', '--delete', src, dst],
      { stdio: ['inherit', 'inherit', 'pipe'] });
  }
}

/**
 * Restores dotfiles from dest/dotfiles/ into homeDir using rsync.
 *
 * @param {string}   dest        - Base backup directory (contains dotfiles/ subdir).
 * @param {string}   homeDir     - Target home directory.
 * @param {Function} [onProgress] - Called after each step with { name, step, status, detail? }
 * @returns {Promise<void>}
 */
export async function restoreDotfiles(dest, homeDir, onProgress = () => {}) {
  const dotfilesDir = path.join(dest, 'dotfiles');
  const entries = fs.readdirSync(dotfilesDir);

  for (const entry of entries) {
    const fullEntry = path.join(dotfilesDir, entry);
    // Same flag rationale as backupDotfiles: -rlptgo avoids -D/--specials
    await run('rsync', ['-rlptgo', '--delete', fullEntry, homeDir + '/'],
      { stdio: ['inherit', 'inherit', 'pipe'] });
    onProgress({ name: entry, step: 'rsync', status: 'ok' });
  }

  // Add restored SSH keys to the agent using --apple-use-keychain
  // to avoid passphrase prompts blocking the restore flow.
  const sshDir = path.join(homeDir, '.ssh');
  if (fs.existsSync(sshDir)) {
    const files = fs.readdirSync(sshDir);
    const privateKeys = files.filter(f => 
      !f.endsWith('.pub') && !f.includes('known_hosts') && !f.includes('config') && !f.includes('environment')
    );
    
    for (const key of privateKeys) {
      const keyPath = path.join(sshDir, key);
      try {
        // --apple-use-keychain: store/retrieve passphrase from macOS Keychain
        await run('ssh-add', ['--apple-use-keychain', keyPath], 
          { stdio: ['ignore', 'ignore', 'ignore'] });
        onProgress({ name: key, step: 'ssh-add', status: 'ok' });
      } catch {
        // Throw a descriptive error so the caller can stop restore and inform the user
        onProgress({ name: key, step: 'ssh-add', status: 'error' });
        const err = new Error(
          `Could not add SSH key ${key} to agent.\n` +
          `Run manually: ssh-add --apple-use-keychain ~/.ssh/${key}\n` +
          `Then re-run the restore.`
        );
        err.sshKey = keyPath;
        throw err;
      }
    }
  }
}
