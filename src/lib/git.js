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
  
  // Only consider tracked file modifications as "changes" - untracked files (?? don't need a patch
  const modifiedOutput = statusOutput.split('\n').filter(line => 
    line.trim() && !line.startsWith('??')
  ).join('\n');
  
  const hasChanges = modifiedOutput.length > 0;

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
 *
 * @param {string}   repoBackupDir - Path to the backup directory for one repo.
 * @param {string}   targetRoot    - Root under which to restore (unused, originalPath is used).
 * @param {Function} [onProgress]  - Called after each step with:
 *   { folderName, step, status, detail? }
 */
export async function restoreRepo(repoBackupDir, targetRoot, onProgress = () => {}) {
  const metaPath = path.join(repoBackupDir, 'meta.json');

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    onProgress({ folderName: path.basename(repoBackupDir), step: 'read-meta', status: 'error', detail: 'meta.json missing or corrupt' });
    return { restored: false, skipped: true, reason: 'meta.json missing' };
  }

  const { path: originalPath, remotes, hasChanges, hasUnpushedCommits } = meta;
  const folderName = path.basename(repoBackupDir);

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
    onProgress({ folderName, step: 'clone', status: 'skip', detail: 'no remotes' });
    return { restored: false, hadChanges: !!hasChanges, hadUnpushedCommits: !!hasUnpushedCommits, skipped: true };
  }

// --- clone ---
  try {
    // Set GIT_SSH_COMMAND to auto-accept new host keys for SSH remotes
    const isSSH = origin.startsWith('git@') || origin.startsWith('ssh://');
    const env = isSSH 
      ? { ...process.env, GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes' }
      : process.env;
    
    await run('git', ['clone', origin, targetPath], { env });
    onProgress({ folderName, step: 'clone', status: 'ok', detail: origin });
  } catch (e) {
    // Clone failed - write instructions for manual cloning
    const instructions = 
      `# Manual restore needed\n` +
      `# Original path: ${originalPath}\n` +
      `# Remote: ${origin}\n` +
      (isSSH 
        ? `# Run: git clone ${origin} ${targetPath}\n`
        : `# Ensure credentials are available, then run: git clone ${origin} ${targetPath}\n`);
    fs.writeFileSync(path.join(repoBackupDir, '.restore-instructions.txt'), instructions);
    onProgress({ folderName, step: 'clone', status: 'error', detail: 'auth required - see .restore-instructions.txt' });
    return { restored: false, hadChanges: !!hasChanges, hadUnpushedCommits: !!hasUnpushedCommits, skipped: false };
  }

  // --- unbundle local commits ---
  if (hasUnpushedCommits && fs.existsSync(bundleFile)) {
    try {
      await run('git', ['-C', targetPath, 'bundle', 'unbundle', bundleFile],
        { stdio: ['inherit', 'pipe', 'pipe'] });
      onProgress({ folderName, step: 'unbundle', status: 'ok', detail: meta.branch || '(local branches)' });
    } catch (e) {
      onProgress({ folderName, step: 'unbundle', status: 'error', detail: e.message });
    }
  } else {
    onProgress({ folderName, step: 'unbundle', status: 'skip' });
  }

  // --- checkout correct branch ---
  const branch = meta.branch && meta.branch !== 'unknown' ? meta.branch : null;
  if (hasUnpushedCommits && branch) {
    try {
      await run('git', ['-C', targetPath, 'checkout', branch],
        { stdio: ['inherit', 'pipe', 'pipe'] });
      onProgress({ folderName, step: 'checkout', status: 'ok', detail: branch });
    } catch (e) {
      onProgress({ folderName, step: 'checkout', status: 'error', detail: e.message });
    }
  } else {
    onProgress({ folderName, step: 'checkout', status: 'skip' });
  }

  // --- apply dirty patch ---
  if (hasChanges && fs.existsSync(patchFile)) {
    // Skip if patch file is empty (can happen if diff command returned empty but status showed changes)
    const patchContent = fs.readFileSync(patchFile, 'utf8');
    if (patchContent.trim().length === 0) {
      onProgress({ folderName, step: 'apply', status: 'skip', detail: 'empty patch file' });
    } else {
      try {
        await run('git', ['-C', targetPath, 'apply', '--whitespace=cr-at-eol', patchFile],
          { stdio: ['inherit', 'pipe', 'pipe'] });
        onProgress({ folderName, step: 'apply', status: 'ok', detail: 'changes.patch' });
      } catch (e) {
        onProgress({ folderName, step: 'apply', status: 'error', detail: 'patch could not be applied' });
      }
    }
  } else {
    onProgress({ folderName, step: 'apply', status: 'skip' });
  }

  return { restored: true, hadChanges: !!hasChanges, hadUnpushedCommits: !!hasUnpushedCommits, skipped: false };
}
