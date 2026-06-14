import * as p from '@clack/prompts';
import { readConfig, defaultConfigPath } from '../lib/config.js';
import { backupBrew } from '../lib/brew.js';
import { backupDotfiles } from '../lib/dotfiles.js';
import { backupAllRepos } from '../lib/git.js';
import os from 'os';

/**
 * Run an async backup step inside a spinner.
 * - On success: stops spinner with a ✓ message.
 * - On SIGINT (Ctrl+C): stops spinner, re-throws so the top-level handler exits.
 * - On other errors: stops spinner with error message, continues to next step.
 */
async function runStep(label, fn) {
  const s = p.spinner();
  s.start(label);
  try {
    const result = await fn();
    s.stop(`${label} ✓`);
    return result;
  } catch (e) {
    s.stop(`${label} failed: ${e.message}`);
    // Only SIGINT (Ctrl+C) propagates — everything else (SIGKILL from OS/OneDrive,
    // non-zero exits, permission errors) is logged and we continue to the next step.
    if (e.signal === 'SIGINT') throw e;
  }
}

export async function runBackup() {
  const config = readConfig(defaultConfigPath());

  if (!config.BACKUP_DEST) {
    p.log.error('No config found. Run: mac-backup config');
    process.exit(1);
  }

  const dest = config.BACKUP_DEST;
  const home = os.homedir();

  const dryRunSuffix = process.env.DRY_RUN === 'true' ? ' (DRY RUN — no commands executed)' : '';
  p.intro(`mac-backup — starting backup${dryRunSuffix}`);

  try {
    // Brew — always run
    await runStep('Homebrew packages', () => backupBrew(dest));

    // Git — run when GIT_ROOT is configured
    if (config.GIT_ROOT) {
      const gitSpinner = p.spinner();
      gitSpinner.start('Git repos — scanning…');
      try {
        const gitRoot = config.GIT_ROOT.replace(/^~(?=\/|$)/, home);
        const result = await backupAllRepos(gitRoot, dest, ({ repo, index, total, folderName, hasChanges, hasUnpushedCommits }) => {
          // Persistent line for this completed repo
          const badges = [];
          if (hasChanges) badges.push('dirty');
          if (hasUnpushedCommits) badges.push('unpushed');
          const badge = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
          const shortName = folderName.replace(/__/g, '/');
          p.log.step(`${shortName}${badge}`);
          // Update spinner to show next repo position
          gitSpinner.message(`Git repos — ${index + 1}/${total}`);
        });
        const notes = [];
        if (result.dirtyCount > 0) notes.push(`${result.dirtyCount} dirty`);
        if (result.unpushedCount > 0) notes.push(`${result.unpushedCount} with unpushed commits`);
        const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : '';
        gitSpinner.stop(`Git repos: ${result.count} backed up${suffix} ✓`);
      } catch (e) {
        gitSpinner.stop(`Git repos failed: ${e.message}`);
        if (e.signal === 'SIGINT') throw e;
      }
    }

    // Dotfiles — run when DOTFILES_PATHS is configured and non-empty
    const dotfilesPaths = (config.DOTFILES_PATHS || '').split(' ').filter(Boolean);
    if (dotfilesPaths.length > 0) {
      await runStep('Dotfiles', () => backupDotfiles(dotfilesPaths, home, dest));
    }

    p.outro(`Backup complete → ${dest}${dryRunSuffix}`);
  } catch (e) {
    if (e.signal === 'SIGINT') {
      process.stdout.write('\n');
      process.exit(130);
    }
    p.log.error(`Unexpected error: ${e.message}`);
    process.exit(1);
  }
}
