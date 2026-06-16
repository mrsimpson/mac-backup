import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const mockSpawn = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({ spawn: mockSpawn }));

import { scanDotfiles, backupDotfiles, restoreDotfiles } from '../lib/dotfiles.js';

/** Returns a fake child process that immediately emits 'close' with exit code 0 */
function makeChild(code = 0, signal = null) {
  const child = new EventEmitter();
  process.nextTick(() => child.emit('close', signal ? null : code, signal));
  return child;
}

const tmpDirs = [];

function makeTmpDir() {
  const dir = path.join(tmpdir(), crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSpawn.mockImplementation(() => makeChild(0));
});

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

// ---------------------------------------------------------------------------
// scanDotfiles (synchronous — no spawn involved)
// ---------------------------------------------------------------------------

describe('scanDotfiles', () => {
  it('returns dot entries but excludes non-dot entries', () => {
    const home = makeTmpDir();
    fs.writeFileSync(path.join(home, '.zshrc'), 'alias ll=ls\n');
    fs.mkdirSync(path.join(home, '.ssh'));
    fs.writeFileSync(path.join(home, '.ssh', 'id_rsa'), 'key');
    fs.writeFileSync(path.join(home, '.ssh', 'id_rsa.pub'), 'pubkey');
    fs.writeFileSync(path.join(home, 'regular-file'), 'data');

    const result = scanDotfiles(home);
    const names = result.map((e) => e.name);

    expect(names).toContain('.zshrc');
    expect(names).toContain('.ssh');
    expect(names).not.toContain('regular-file');
  });

  it('skips .Trash directory', () => {
    const home = makeTmpDir();
    fs.mkdirSync(path.join(home, '.Trash'));
    fs.writeFileSync(path.join(home, '.zshrc'), '');

    const names = scanDotfiles(home).map((e) => e.name);
    expect(names).not.toContain('.Trash');
    expect(names).toContain('.zshrc');
  });

  it('skips entries starting with .Library', () => {
    const home = makeTmpDir();
    fs.mkdirSync(path.join(home, '.Library'));
    fs.writeFileSync(path.join(home, '.zshrc'), '');

    const names = scanDotfiles(home).map((e) => e.name);
    expect(names).not.toContain('.Library');
    expect(names).toContain('.zshrc');
  });

  it('label format matches ~/name (N files, N KB)', () => {
    const home = makeTmpDir();
    fs.writeFileSync(path.join(home, '.gitconfig'), '[user]\n  name=Test\n');

    const entry = scanDotfiles(home).find((e) => e.name === '.gitconfig');
    expect(entry).toBeDefined();
    expect(entry.label).toMatch(/^~\/.gitconfig \(1 files, \d+ KB\)$/);
  });

  it('directory entry has fileCount equal to number of files in dir', () => {
    const home = makeTmpDir();
    fs.mkdirSync(path.join(home, '.config'));
    fs.writeFileSync(path.join(home, '.config', 'a'), '');
    fs.writeFileSync(path.join(home, '.config', 'b'), '');
    fs.writeFileSync(path.join(home, '.config', 'c'), '');

    const entry = scanDotfiles(home).find((e) => e.name === '.config');
    expect(entry).toBeDefined();
    expect(entry.fileCount).toBe(3);
  });

  it('file entry always has fileCount of 1', () => {
    const home = makeTmpDir();
    fs.writeFileSync(path.join(home, '.npmrc'), 'registry=https://registry.npmjs.org\n');

    const entry = scanDotfiles(home).find((e) => e.name === '.npmrc');
    expect(entry).toBeDefined();
    expect(entry.fileCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// backupDotfiles
// ---------------------------------------------------------------------------

describe('backupDotfiles', () => {
  it('calls spawn at least once (smoke test)', async () => {
    const home = makeTmpDir();
    const dest = makeTmpDir();
    await backupDotfiles(['.zshrc'], home, dest);
    expect(mockSpawn).toHaveBeenCalled();
  });

  it('uses rsync for all paths with -rlptgo (no -D/--specials)', async () => {
    const home = makeTmpDir();
    const dest = makeTmpDir();
    await backupDotfiles(['.zshrc', '.gitconfig'], home, dest);

    const calls = mockSpawn.mock.calls;
    const rsyncCall = calls.find(([cmd]) => cmd === 'rsync');
    expect(rsyncCall).toBeDefined();
    const args = rsyncCall[1];
    expect(args).toContain('-rlptgo');
    expect(args).toContain('--delete');
    expect(args).not.toContain('-a'); // -a includes -D which breaks on OneDrive
    expect(args.some(a => a.includes('.zshrc'))).toBe(true);
  });

  it('uses rsync for .ssh (no GPG encryption)', async () => {
    const home = makeTmpDir();
    const dest = makeTmpDir();
    await backupDotfiles(['.ssh'], home, dest);

    const calls = mockSpawn.mock.calls;
    expect(calls.every(([cmd]) => cmd === 'rsync')).toBe(true);
    expect(calls.every(([, args]) => !args.some(a => a.includes('gpg')))).toBe(true);
  });

  it('uses rsync for .gnupg (no GPG encryption)', async () => {
    const home = makeTmpDir();
    const dest = makeTmpDir();
    await backupDotfiles(['.gnupg'], home, dest);

    const calls = mockSpawn.mock.calls;
    expect(calls.every(([cmd]) => cmd === 'rsync')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// restoreDotfiles
// ---------------------------------------------------------------------------

describe('restoreDotfiles', () => {
  it('uses rsync for all entries (no GPG)', async () => {
    const dest = makeTmpDir();
    fs.mkdirSync(path.join(dest, 'dotfiles'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'dotfiles', '.zshrc'), '');
    fs.writeFileSync(path.join(dest, 'dotfiles', '.gitconfig'), '');

    await restoreDotfiles(dest, '/tmp/home');

    const calls = mockSpawn.mock.calls;
    expect(calls.every(([cmd]) => cmd === 'rsync')).toBe(true);
    expect(calls.some(([, args]) => args.some(a => a.includes('.zshrc')))).toBe(true);
  });

  it('never calls gpg during restore', async () => {
    const dest = makeTmpDir();
    fs.mkdirSync(path.join(dest, 'dotfiles'), { recursive: true });
    fs.writeFileSync(path.join(dest, 'dotfiles', '.ssh'), '');

    await restoreDotfiles(dest, '/tmp/home');

    const calls = mockSpawn.mock.calls;
    expect(calls.every(([cmd]) => cmd !== 'gpg')).toBe(true);
  });

  it('recreates symlinks from backup without calling rsync for them', async () => {
    const dest = makeTmpDir();
    const home = makeTmpDir();
    const dotfilesDir = path.join(dest, 'dotfiles');
    fs.mkdirSync(dotfilesDir, { recursive: true });

    // Simulate a symlink in the backup (e.g. .ssh -> /Users/.../SynologyDrive/dotfiles/.ssh)
    const symlinkTarget = '/Users/oliverjaegle/SynologyDrive/dotfiles/.ssh';
    fs.symlinkSync(symlinkTarget, path.join(dotfilesDir, '.ssh'));

    const progress = [];
    await restoreDotfiles(dest, home, (evt) => progress.push(evt));

    // rsync must NOT be called for the symlink entry
    expect(mockSpawn).not.toHaveBeenCalled();

    // The symlink must be recreated at the destination
    const destLink = path.join(home, '.ssh');
    const destStat = fs.lstatSync(destLink);
    expect(destStat.isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(destLink)).toBe(symlinkTarget);

    // Progress reported with step 'symlink'
    expect(progress.some(e => e.step === 'symlink' && e.status === 'ok')).toBe(true);
  });

  it('overwrites a stale symlink at destination with the backup symlink', async () => {
    const dest = makeTmpDir();
    const home = makeTmpDir();
    const dotfilesDir = path.join(dest, 'dotfiles');
    fs.mkdirSync(dotfilesDir, { recursive: true });

    const newTarget = '/Users/oliverjaegle/SynologyDrive/dotfiles/.ssh';
    fs.symlinkSync(newTarget, path.join(dotfilesDir, '.ssh'));

    // Pre-existing stale symlink pointing elsewhere
    fs.symlinkSync('/old/path/.ssh', path.join(home, '.ssh'));

    await restoreDotfiles(dest, home);

    expect(fs.readlinkSync(path.join(home, '.ssh'))).toBe(newTarget);
  });

  it('skips OneDrive conflict copies (entries ending with space+number)', async () => {
    const dest = makeTmpDir();
    const home = makeTmpDir();
    const dotfilesDir = path.join(dest, 'dotfiles');
    fs.mkdirSync(dotfilesDir, { recursive: true });
    fs.writeFileSync(path.join(dotfilesDir, '.zshrc'), 'good');
    fs.writeFileSync(path.join(dotfilesDir, '.zshrc 1'), 'conflict copy');

    await restoreDotfiles(dest, home);

    // Only .zshrc triggers rsync, not the conflict copy
    const rsyncArgs = mockSpawn.mock.calls.flatMap(([, args]) => args);
    expect(rsyncArgs.some(a => a.includes('.zshrc 1'))).toBe(false);
    expect(rsyncArgs.some(a => a.includes('.zshrc'))).toBe(true);
  });
});
