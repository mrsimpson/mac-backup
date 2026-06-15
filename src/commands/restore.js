import * as p from '@clack/prompts';
import { readConfig, defaultConfigPath } from '../lib/config.js';
import { restoreBrew } from '../lib/brew.js';
import { restoreDotfiles, addSshKeysToAgent } from '../lib/dotfiles.js';
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
    p.log.error('No config found. Run: mac-backup config');
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

  const dryRunSuffix = process.env.DRY_RUN === 'true' ? ' (DRY RUN — no commands executed)' : '';
  p.intro(`mac-backup — restore${dryRunSuffix}`);
  p.note(available.map(a => `• ${a}`).join('\n'), 'Available to restore');

  let confirmed = true;
  if (process.env.YES === 'true') {
    p.log.step('Proceed with restore? Yes (--yes flag)');
  } else {
    confirmed = await p.confirm({ message: 'Proceed with restore?' });
  }
  if (p.isCancel(confirmed) || !confirmed) {
    p.outro('Nothing restored.');
    return;
  }

  try {
    if (available.includes('homebrew')) {
      await runStep('Homebrew packages', () => restoreBrew(dest));
    }

    // Restore dotfiles first - this includes SSH keys needed for git clones
    if (available.includes('dotfiles')) {
      const dotfilesSpinner = p.spinner();
      dotfilesSpinner.start('Dotfiles — restoring...');

      await restoreDotfiles(dest, home, ({ name, step, status }) => {
        const icon = status === 'ok' ? '✓' : '✗';
        p.log.step(`  ${name}: ${step} ${icon}`);
        dotfilesSpinner.message(`Dotfiles — ${name}`);
      });

      dotfilesSpinner.stop('Dotfiles ✓');

      // Add SSH keys to agent as a dedicated step so git clones can authenticate
      const sshSpinner = p.spinner();
      sshSpinner.start('SSH keys — adding to agent...');
      let sshKeyCount = 0;

      await addSshKeysToAgent(home, ({ name, step, status, detail }) => {
        const icon = status === 'ok' ? '✓' : status === 'skip' ? '–' : '✗';
        const detailStr = detail ? ` (${detail})` : '';
        if (status !== 'skip') {
          p.log.step(`  ${name}: ${step} ${icon}${detailStr}`);
        }
        if (status === 'ok') sshKeyCount++;
        sshSpinner.message(`SSH keys — ${name}`);
      });

      sshSpinner.stop(`SSH keys: ${sshKeyCount} added ✓`);
    }

    if (available.includes('git')) {
      const gitBackupDir = path.join(dest, 'git');
      const repoDirs = fs.readdirSync(gitBackupDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => path.join(gitBackupDir, e.name));

      const gitSpinner = p.spinner();
      gitSpinner.start(`Git repos — 0/${repoDirs.length}`);

      let restoredCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (let index = 0; index < repoDirs.length; index++) {
        const repoDir = repoDirs[index];
        const folderName = path.basename(repoDir);
        const shortName = folderName.replace(/__/g, '/');
        const metaPath = path.join(repoDir, 'meta.json');

        // Check meta.json existence before calling restoreRepo so we log cleanly
        if (!fs.existsSync(metaPath)) {
          p.log.step(`${shortName} [meta.json missing, skipped]`);
          skippedCount++;
          gitSpinner.message(`Git repos — ${index + 1}/${repoDirs.length}`);
          continue;
        }

        try {
          const result = await restoreRepo(repoDir, home, ({ folderName: fn, step, status, detail }) => {
            const statusIcon = status === 'ok' ? '✓' : status === 'skip' ? '–' : '✗';
            const stepStr = step === 'read-meta' ? 'meta' : step;
            const detailStr = detail ? ` ${detail}` : '';
            if (status !== 'skip') {
              p.log.step(`  ${shortName}: ${stepStr} ${statusIcon}${detailStr}`);
            }
          });

          if (result.restored) restoredCount++;
          else if (result.skipped) skippedCount++;
          else errorCount++;
        } catch (e) {
          gitSpinner.stop(`Git repos: ${restoredCount} restored, ${skippedCount} skipped, ${errorCount} errors`);
          p.log.error(e.message);
          p.outro('Restore stopped. Fix the issue above and re-run restore.');
          process.exit(1);
        }

        gitSpinner.message(`Git repos — ${index + 1}/${repoDirs.length}`);
      }

      const parts = [];
      if (restoredCount > 0) parts.push(`${restoredCount} restored`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (errorCount > 0) parts.push(`${errorCount} errors`);
      gitSpinner.stop(`Git repos: ${parts.join(', ')} ✓`);
    }

    p.outro(`Restore complete${dryRunSuffix}`);
  } catch (e) {
    if (e.signal === 'SIGINT') {
      process.stdout.write('\n');
      process.exit(130);
    }
    p.log.error(`Unexpected error: ${e.message}`);
    process.exit(1);
  }
}
