import * as p from '@clack/prompts';
import { readConfig, defaultConfigPath } from '../lib/config.js';
import { restoreBrew } from '../lib/brew.js';
import { restoreDotfiles } from '../lib/dotfiles.js';
import { restoreRepo } from '../lib/git.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function runStep(label, fn) {
  const s = p.spinner();
  s.start(label);
  try {
    const result = await fn();
    s.stop(`${label} ✓`);
    return result;
  } catch (e) {
    s.stop(`${label} failed: ${e.message}`);
    // Only SIGINT propagates — SIGKILL (OS/OneDrive killing rsync) is non-fatal.
    if (e.signal === 'SIGINT') throw e;
  }
}

export async function runRestore() {
  const config = readConfig(defaultConfigPath());

  if (!config.BACKUP_DEST) {
    p.log.error('No config found. Run: ./db-backup config');
    process.exit(1);
  }

  const dest = config.BACKUP_DEST;
  const home = os.homedir();

  const available = [];
  if (fs.existsSync(path.join(dest, 'homebrew', 'Brewfile'))) available.push('homebrew');
  if (fs.existsSync(path.join(dest, 'git'))) available.push('git');
  if (fs.existsSync(path.join(dest, 'dotfiles'))) available.push('dotfiles');

  if (available.length === 0) {
    p.log.error(`No backup data found at: ${dest}`);
    process.exit(1);
  }

  p.intro('db-backup — restore');
  p.note(available.map(a => `• ${a}`).join('\n'), 'Available to restore');

  const confirmed = await p.confirm({ message: 'Proceed with restore?' });
  if (p.isCancel(confirmed) || !confirmed) {
    p.outro('Nothing restored.');
    return;
  }

  try {
    if (available.includes('homebrew')) {
      await runStep('Homebrew packages', () => restoreBrew(dest));
    }

    if (available.includes('git')) {
      await runStep('Git repos', async () => {
        const gitBackupDir = path.join(dest, 'git');
        const repoDirs = fs.readdirSync(gitBackupDir, { withFileTypes: true })
          .filter(e => e.isDirectory())
          .map(e => path.join(gitBackupDir, e.name));
        let count = 0;
        for (const repoDir of repoDirs) {
          await restoreRepo(repoDir, home);
          count++;
        }
        return count;
      });
    }

    if (available.includes('dotfiles')) {
      await runStep('Dotfiles', () => restoreDotfiles(dest, home));
    }

    p.outro('Restore complete');
  } catch (e) {
    if (e.signal === 'SIGINT') {
      process.stdout.write('\n');
      process.exit(130);
    }
    p.log.error(`Unexpected error: ${e.message}`);
    process.exit(1);
  }
}
