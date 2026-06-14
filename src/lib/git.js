import fs from 'fs';
import path from 'path';
import { q, run, runSync } from './shell.js';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.terraform', '.venv',
  '__pycache__', 'target', 'vendor', '.git',
]);

/**
 * Parse `git remote -v` output into a remotes map.
 * Only fetch lines are kept; first occurrence of each remote name wins.
 */
function parseRemotes(output) {
  const remotes = {};
  for (const line of output.trim().split('\n')) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
    if (match) {
      const [, name, url] = match;
      if (!(name in remotes)) remotes[name] = url;
    }
  }
  return remotes;
}

/**
 * Recursively find all git repos under `root`, up to `maxDepth` levels deep.
 */
export function findGitRepos(root, maxDepth = 4) {
  const repos = [];

  function scan(dir, depth) {
    if (depth >= maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const gitEntry = path.join(fullPath, '.git');
      if (fs.existsSync(gitEntry)) {
        try {
          const stat = fs.statSync(gitEntry);
          if (stat.isDirectory()) {
            // Proper standalone repo — back it up
            repos.push(fullPath);
          }
          // .git is a file → worktree or submodule pointer; skip silently
        } catch {
          // Can't stat — skip
        }
      } else {
        scan(fullPath, depth + 1);
      }
    }
  }

  scan(root, 0);
  return repos;
}

/**
 * Compute a folder name for a repo relative to root.
 * Slashes in the relative path are replaced with `__`.
 */
export function repoFolderName(repoPath, root) {
  const rel = path.relative(root, repoPath);
  return rel.split(path.sep).join('__');
}

/**
 * Back up a single git repo's metadata to `dest/git/<folderName>/`.
 *
 * Fast git metadata queries use runSync (execSync) — they complete in <100ms.
 * The bundle creation (potentially slow) uses async run() so Ctrl+C works.
 *
 * Written files:
 *   meta.json              — always
 *   changes.patch          — only when working tree is dirty
 *   local-commits.bundle   — only when local commits are not on any remote
 */
export async function backupRepo(repoPath, dest, root) {
  const effectiveRoot = root !== undefined ? root : path.dirname(repoPath);
  const folderName = repoFolderName(repoPath, effectiveRoot);
  const outDir = path.join(dest, 'git', folderName);
  fs.mkdirSync(outDir, { recursive: true });

  // All sync git queries use fully-piped stdio so no git messages bleed to the terminal.
  // Errors (non-zero exit) are caught and silently ignored — the empty default is used instead.
  const syncOpts = { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };

  // --- remotes (fast, sync) ---
  let remoteOutput = '';
  try {
    remoteOutput = runSync(`git -C ${q(repoPath)} remote -v`, syncOpts);
  } catch {}
  const remotes = parseRemotes(remoteOutput);

  // --- branch (fast, sync) ---
  let branch = 'unknown';
  try {
    branch = runSync(`git -C ${q(repoPath)} rev-parse --abbrev-ref HEAD`, syncOpts).trim();
  } catch {}

  // --- dirty working tree (fast, sync) ---
  let statusOutput = '';
  try {
    statusOutput = runSync(`git -C ${q(repoPath)} status --porcelain`, syncOpts);
  } catch {}
  const hasChanges = statusOutput.trim().length > 0;

  // --- diff patch (fast, sync) ---
  let patch = '';
  if (hasChanges) {
    try {
      patch = runSync(`git -C ${q(repoPath)} diff HEAD`, syncOpts);
    } catch {
      try {
        patch = runSync(`git -C ${q(repoPath)} diff`, syncOpts);
      } catch {}
    }
  }

  // --- unpushed commits check (fast, sync) ---
  let hasUnpushedCommits = false;
  try {
    const unpushedLog = runSync(
      `git -C ${q(repoPath)} log --branches --not --remotes --oneline`,
      syncOpts
    );
    hasUnpushedCommits = unpushedLog.trim().length > 0;
  } catch {}

  // --- bundle (potentially slow: async so Ctrl+C works, stdio piped to suppress output) ---
  if (hasUnpushedCommits) {
    const bundleFile = path.join(outDir, 'local-commits.bundle');
    try {
      await run('git', ['-C', repoPath, 'bundle', 'create', bundleFile, '--branches', '--not', '--remotes'],
        { stdio: ['inherit', 'pipe', 'pipe'] });
    } catch {
      hasUnpushedCommits = false;
    }
  }

  // --- write files ---
  const meta = { path: repoPath, remotes, branch, hasChanges, hasUnpushedCommits };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
  if (hasChanges) {
    fs.writeFileSync(path.join(outDir, 'changes.patch'), patch);
  }

  return { folderName, hasChanges, hasUnpushedCommits, remoteCount: Object.keys(remotes).length };
}

/**
 * Back up all git repos found under `root` to `dest`.
 *
 * @param {string}   root
 * @param {string}   dest
 * @param {Function} [onProgress] - Called after each repo with:
 *   { repo, index, total, folderName, hasChanges, hasUnpushedCommits, remoteCount }
 */
export async function backupAllRepos(root, dest, onProgress) {
  const repos = findGitRepos(root);
  let dirtyCount = 0;
  let unpushedCount = 0;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const result = await backupRepo(repo, dest, root);
    if (result.hasChanges) dirtyCount++;
    if (result.hasUnpushedCommits) unpushedCount++;
    if (onProgress) {
      onProgress({ repo, index: i, total: repos.length, ...result });
    }
  }

  return { count: repos.length, dirtyCount, unpushedCount };
}

/**
 * Restore a single git repo from a backup directory.
 */
export async function restoreRepo(repoBackupDir, targetRoot) {
  const metaPath = path.join(repoBackupDir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const { path: originalPath, remotes, hasChanges, hasUnpushedCommits } = meta;

  const targetPath = originalPath;
  const origin = remotes.origin || Object.values(remotes)[0] || '';
  const bundleFile = path.join(repoBackupDir, 'local-commits.bundle');
  const patchFile = path.join(repoBackupDir, 'changes.patch');

  if (!origin) {
    const instructions =
      `# Restore instructions\n` +
      `# Original path: ${originalPath}\n` +
      `# This repo had no remotes. Restore manually from the bundle if present.\n` +
      (fs.existsSync(bundleFile)
        ? `# git clone ${q(bundleFile)} ${q(targetPath)}\n`
        : '');
    fs.writeFileSync(path.join(repoBackupDir, '.restore-instructions.txt'), instructions);
    return { restored: false, hadChanges: !!hasChanges, hadUnpushedCommits: !!hasUnpushedCommits };
  }

  await run('git', ['clone', origin, targetPath]);

  if (hasUnpushedCommits && fs.existsSync(bundleFile)) {
    await run('git', ['-C', targetPath, 'bundle', 'unbundle', bundleFile],
      { stdio: ['inherit', 'pipe', 'pipe'] });
  }

  if (hasChanges && fs.existsSync(patchFile)) {
    await run('git', ['-C', targetPath, 'apply', patchFile],
      { stdio: ['inherit', 'pipe', 'pipe'] });
  }

  if (hasUnpushedCommits && meta.branch && meta.branch !== 'unknown') {
    try {
      await run('git', ['-C', targetPath, 'checkout', meta.branch],
        { stdio: ['inherit', 'pipe', 'pipe'] });
    } catch {}
  }

  return { restored: true, hadChanges: !!hasChanges, hadUnpushedCommits: !!hasUnpushedCommits };
}
