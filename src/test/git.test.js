import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// runSync (re-exported execSync) is used for fast git metadata queries
const mockExecSync = vi.hoisted(() => vi.fn());
// spawn is used for git bundle create (slow, async)
const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({ execSync: mockExecSync, spawn: mockSpawn }));

import { findGitRepos, repoFolderName, backupRepo, backupAllRepos, restoreRepo } from '../lib/git.js';

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

// Helper: set up execSync mock sequence for a clean repo (no dirty, no unpushed)
// execSync call order inside backupRepo:
//   1. git remote -v
//   2. git rev-parse --abbrev-ref HEAD
//   3. git status --porcelain        → '' (clean)
//   4. git log --branches --not --remotes --oneline  → '' (no unpushed)
function mockCleanRepo(remote = 'origin\tgit@github.com:org/repo.git (fetch)\n') {
  mockExecSync
    .mockReturnValueOnce(remote)
    .mockReturnValueOnce('main\n')
    .mockReturnValueOnce('')   // clean status
    .mockReturnValueOnce(''); // no unpushed
}

// Dirty working tree, no unpushed commits
function mockDirtyRepo(patch = '--- a/f\n+++ b/f\n', remote = 'origin\tgit@github.com:org/repo.git (fetch)\n') {
  mockExecSync
    .mockReturnValueOnce(remote)
    .mockReturnValueOnce('main\n')
    .mockReturnValueOnce('M file.js\n') // dirty
    .mockReturnValueOnce(patch)          // diff HEAD
    .mockReturnValueOnce('');            // no unpushed
}

// Clean working tree, but has unpushed commits (spawn used for bundle)
function mockRepoWithUnpushed(remote = 'origin\tgit@github.com:org/repo.git (fetch)\n') {
  mockExecSync
    .mockReturnValueOnce(remote)
    .mockReturnValueOnce('feat/local\n')
    .mockReturnValueOnce('')                       // clean status
    .mockReturnValueOnce('abc1234 local commit\n'); // has unpushed
  // spawn (bundle create) will use mockSpawn which defaults to makeChild(0)
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
// repoFolderName
// ---------------------------------------------------------------------------

describe('repoFolderName', () => {
  it('replaces slashes with __ for nested repo', () => {
    expect(repoFolderName('/home/user/projects/org/repo', '/home/user/projects')).toBe('org__repo');
  });

  it('returns bare name for top-level repo', () => {
    expect(repoFolderName('/home/user/projects/repo', '/home/user/projects')).toBe('repo');
  });
});

// ---------------------------------------------------------------------------
// findGitRepos
// ---------------------------------------------------------------------------

describe('findGitRepos', () => {
  it('finds repos and skips node_modules', () => {
    const root = makeTmpDir();
    fs.mkdirSync(path.join(root, 'repo1', '.git'), { recursive: true });
    fs.mkdirSync(path.join(root, 'repo2', '.git'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', 'fake-repo', '.git'), { recursive: true });

    const repos = findGitRepos(root);
    expect(repos).toContain(path.join(root, 'repo1'));
    expect(repos).toContain(path.join(root, 'repo2'));
    expect(repos.every((r) => !r.includes('node_modules'))).toBe(true);
  });

  it('respects maxDepth', () => {
    const root = makeTmpDir();
    fs.mkdirSync(path.join(root, 'a', 'b', 'c', 'd', 'e', 'repo', '.git'), { recursive: true });
    expect(findGitRepos(root, 2)).toHaveLength(0);
  });

  it('skips directories where .git is a file (worktree/submodule), not a directory', () => {
    const root = makeTmpDir();
    // proper repo — .git is a directory
    fs.mkdirSync(path.join(root, 'real-repo', '.git'), { recursive: true });
    // worktree — .git is a file (gitdir pointer)
    fs.mkdirSync(path.join(root, 'worktree-dir'), { recursive: true });
    fs.writeFileSync(path.join(root, 'worktree-dir', '.git'), 'gitdir: /some/other/.git/worktrees/foo\n');

    const repos = findGitRepos(root);
    expect(repos).toContain(path.join(root, 'real-repo'));
    expect(repos).not.toContain(path.join(root, 'worktree-dir'));
  });
});

// ---------------------------------------------------------------------------
// backupRepo — clean repo
// ---------------------------------------------------------------------------

describe('backupRepo — clean repo', () => {
  it('writes meta.json with correct fields', async () => {
    const dest = makeTmpDir();
    mockCleanRepo();

    await backupRepo('/fake/root/org/repo', dest, '/fake/root');

    const meta = JSON.parse(fs.readFileSync(path.join(dest, 'git', 'org__repo', 'meta.json'), 'utf8'));
    expect(meta.path).toBe('/fake/root/org/repo');
    expect(meta.branch).toBe('main');
    expect(meta.hasChanges).toBe(false);
    expect(meta.hasUnpushedCommits).toBe(false);
    expect(meta.remotes.origin).toBe('git@github.com:org/repo.git');
  });

  it('does not write changes.patch', async () => {
    const dest = makeTmpDir();
    mockCleanRepo();
    await backupRepo('/fake/root/repo', dest, '/fake/root');
    expect(fs.existsSync(path.join(dest, 'git', 'repo', 'changes.patch'))).toBe(false);
  });

  it('does not write local-commits.bundle', async () => {
    const dest = makeTmpDir();
    mockCleanRepo();
    await backupRepo('/fake/root/repo', dest, '/fake/root');
    expect(fs.existsSync(path.join(dest, 'git', 'repo', 'local-commits.bundle'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// backupRepo — dirty working tree
// ---------------------------------------------------------------------------

describe('backupRepo — dirty working tree', () => {
  it('writes changes.patch with diff content', async () => {
    const dest = makeTmpDir();
    const patchContent = '--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@\n-old\n+new\n';
    mockDirtyRepo(patchContent);

    await backupRepo('/fake/root/repo', dest, '/fake/root');

    const patchPath = path.join(dest, 'git', 'repo', 'changes.patch');
    expect(fs.existsSync(patchPath)).toBe(true);
    expect(fs.readFileSync(patchPath, 'utf8')).toBe(patchContent);
  });

  it('sets hasChanges=true in meta.json', async () => {
    const dest = makeTmpDir();
    mockDirtyRepo();
    await backupRepo('/fake/root/repo', dest, '/fake/root');
    const meta = JSON.parse(fs.readFileSync(path.join(dest, 'git', 'repo', 'meta.json'), 'utf8'));
    expect(meta.hasChanges).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// backupRepo — unpushed commits
// ---------------------------------------------------------------------------

describe('backupRepo — unpushed commits', () => {
  it('sets hasUnpushedCommits=true in meta.json', async () => {
    const dest = makeTmpDir();
    mockRepoWithUnpushed();
    await backupRepo('/fake/root/repo', dest, '/fake/root');
    const meta = JSON.parse(fs.readFileSync(path.join(dest, 'git', 'repo', 'meta.json'), 'utf8'));
    expect(meta.hasUnpushedCommits).toBe(true);
  });

  it('calls git bundle create via spawn when unpushed commits exist', async () => {
    const dest = makeTmpDir();
    mockRepoWithUnpushed();
    await backupRepo('/fake/root/repo', dest, '/fake/root');

    const spawnCalls = mockSpawn.mock.calls;
    const bundleCall = spawnCalls.find(([cmd, args]) => cmd === 'git' && args.includes('bundle'));
    expect(bundleCall).toBeDefined();
    expect(bundleCall[1]).toContain('create');
    expect(bundleCall[1].some(a => a.includes('local-commits.bundle'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// backupAllRepos
// ---------------------------------------------------------------------------

describe('backupAllRepos', () => {
  it('returns count, dirtyCount, and unpushedCount', async () => {
    const root = makeTmpDir();
    const dest = makeTmpDir();
    fs.mkdirSync(path.join(root, 'repo1', '.git'), { recursive: true });
    fs.mkdirSync(path.join(root, 'repo2', '.git'), { recursive: true });

    mockDirtyRepo(); // repo1: dirty, no unpushed
    mockCleanRepo(); // repo2: clean, no unpushed

    const result = await backupAllRepos(root, dest);
    expect(result.count).toBe(2);
    expect(result.dirtyCount).toBe(1);
    expect(result.unpushedCount).toBe(0);
  });

  it('calls onProgress once per repo with correct fields', async () => {
    const root = makeTmpDir();
    const dest = makeTmpDir();
    fs.mkdirSync(path.join(root, 'repo1', '.git'), { recursive: true });
    fs.mkdirSync(path.join(root, 'repo2', '.git'), { recursive: true });

    mockDirtyRepo(); // repo1: dirty
    mockCleanRepo(); // repo2: clean

    const calls = [];
    await backupAllRepos(root, dest, (info) => calls.push(info));

    expect(calls).toHaveLength(2);
    expect(calls[0].index).toBe(0);
    expect(calls[0].total).toBe(2);
    expect(calls[1].index).toBe(1);
    // one dirty, one clean
    const dirtyCall = calls.find(c => c.hasChanges);
    expect(dirtyCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// restoreRepo
// ---------------------------------------------------------------------------

describe('restoreRepo', () => {
  it('clones from origin for a clean fully-pushed repo', async () => {
    const backupDir = makeTmpDir();
    fs.writeFileSync(path.join(backupDir, 'meta.json'), JSON.stringify({
      path: '/home/user/projects/repo',
      remotes: { origin: 'git@github.com:org/repo.git' },
      branch: 'main',
      hasChanges: false,
      hasUnpushedCommits: false,
    }));

    await restoreRepo(backupDir, '/home/user/projects');

    const spawnCalls = mockSpawn.mock.calls;
    expect(spawnCalls.some(([cmd, args]) => cmd === 'git' && args.includes('clone'))).toBe(true);
    expect(spawnCalls.every(([cmd, args]) => !(cmd === 'git' && args.includes('apply')))).toBe(true);
    expect(spawnCalls.every(([cmd, args]) => !(cmd === 'git' && args.includes('unbundle')))).toBe(true);
  });

  it('clones, unbundles, and applies patch when both flags are true', async () => {
    const backupDir = makeTmpDir();
    fs.writeFileSync(path.join(backupDir, 'meta.json'), JSON.stringify({
      path: '/home/user/projects/repo',
      remotes: { origin: 'git@github.com:org/repo.git' },
      branch: 'feat/local',
      hasChanges: true,
      hasUnpushedCommits: true,
    }));
    fs.writeFileSync(path.join(backupDir, 'changes.patch'), 'patch content');
    fs.writeFileSync(path.join(backupDir, 'local-commits.bundle'), 'bundle data');

    const result = await restoreRepo(backupDir, '/some/root');

    const spawnCalls = mockSpawn.mock.calls;
    expect(spawnCalls.some(([cmd, args]) => cmd === 'git' && args.includes('clone'))).toBe(true);
    expect(spawnCalls.some(([cmd, args]) => cmd === 'git' && args.includes('unbundle'))).toBe(true);
    expect(spawnCalls.some(([cmd, args]) => cmd === 'git' && args.includes('apply'))).toBe(true);
    expect(result.restored).toBe(true);
    expect(result.hadChanges).toBe(true);
    expect(result.hadUnpushedCommits).toBe(true);
  });

  it('writes restore-instructions.txt when repo has no remotes', async () => {
    const backupDir = makeTmpDir();
    fs.writeFileSync(path.join(backupDir, 'meta.json'), JSON.stringify({
      path: '/home/user/projects/local-only',
      remotes: {},
      branch: 'main',
      hasChanges: false,
      hasUnpushedCommits: false,
    }));

    const result = await restoreRepo(backupDir, '/home/user/projects');
    expect(fs.existsSync(path.join(backupDir, '.restore-instructions.txt'))).toBe(true);
    expect(result.restored).toBe(false);
  });
});
