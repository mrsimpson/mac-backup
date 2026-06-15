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
      // exit code 23 = partial transfer due to skipped special files (sockets, pipes)
      // these can't be stored on cloud-synced destinations like OneDrive — harmless
      { stdio: ['inherit', 'inherit', 'pipe'], allowedExitCodes: [23] });
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
      // exit code 23 = partial transfer due to skipped special files (sockets, pipes)
      // these can't be stored on cloud-synced destinations like OneDrive — harmless
      { stdio: ['inherit', 'inherit', 'pipe'], allowedExitCodes: [23] });
    onProgress({ name: entry, step: 'rsync', status: 'ok' });
  }
}

/**
 * Returns true if the file looks like an OpenSSH private key.
 * Reads only the first line to check the header.
 */
function isOpenSshKey(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(64);
    const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    const header = buf.slice(0, bytesRead).toString('utf8');
    return header.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----') ||
           header.startsWith('-----BEGIN RSA PRIVATE KEY-----') ||
           header.startsWith('-----BEGIN EC PRIVATE KEY-----') ||
           header.startsWith('-----BEGIN DSA PRIVATE KEY-----');
  } catch {
    return false;
  }
}

/**
 * Adds SSH private keys from homeDir/.ssh to the SSH agent.
 *
 * @param {string}   homeDir     - Home directory containing .ssh/.
 * @param {Function} [onProgress] - Called per key with { name, step, status, detail? }
 * @returns {Promise<void>}
 */
export async function addSshKeysToAgent(homeDir, onProgress = () => {}) {
  const sshDir = path.join(homeDir, '.ssh');
  if (!fs.existsSync(sshDir)) return;

  const files = fs.readdirSync(sshDir);
  const candidates = files.filter(f =>
    !f.endsWith('.pub') &&           // public keys
    !f.startsWith('S.') &&           // sockets — runtime, not transferable
    !f.includes('known_hosts') &&    // host fingerprint cache
    !f.includes('config') &&         // ssh client config
    !f.includes('environment') &&    // session environment
    !f.includes('authorized_keys')   // server-side auth list
  );

  for (const key of candidates) {
    const keyPath = path.join(sshDir, key);

    // Skip non-OpenSSH key formats (e.g. .pem AWS keypairs, random files)
    if (!isOpenSshKey(keyPath)) {
      onProgress({ name: key, step: 'ssh-add', status: 'skip', detail: 'not an OpenSSH key' });
      continue;
    }

    try {
      // --apple-use-keychain: retrieve passphrase from macOS Keychain silently
      // SSH_ASKPASS_REQUIRE=force + a no-op askpass prevents TTY passphrase prompts
      // that would stall even with stdio ignored. If the key needs a passphrase
      // not in Keychain, ssh-add exits non-zero and we throw a helpful error.
      await run('ssh-add', ['--apple-use-keychain', keyPath],
        { 
          stdio: ['ignore', 'ignore', 'ignore'],
          env: { 
            ...process.env, 
            SSH_ASKPASS: '/usr/bin/false',
            SSH_ASKPASS_REQUIRE: 'force',
            DISPLAY: 'none'
          }
        });
      onProgress({ name: key, step: 'ssh-add', status: 'ok' });
    } catch {
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
