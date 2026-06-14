import * as p from '@clack/prompts';
import { autocompleteMultiselect } from '@clack/prompts';
import { readConfig, writeConfig, defaultConfigPath } from '../lib/config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Scan $HOME for dot-prefixed entries, skip .Trash and .Library prefixed entries.
 * Returns array of { value, label } for autocompleteMultiselect.
 */
function scanDotfiles(homeDir) {
  return fs.readdirSync(homeDir, { withFileTypes: true })
    .filter(e => e.name.startsWith('.') && e.name !== '.Trash' && !e.name.startsWith('.Library'))
    .map(e => {
      const fullPath = path.join(homeDir, e.name);
      let count = 0, sizeKb = 0;
      try {
        if (e.isDirectory()) {
          const files = fs.readdirSync(fullPath);
          count = files.length;
          sizeKb = Math.round(count * 2);
        } else {
          const stat = fs.statSync(fullPath);
          count = 1;
          sizeKb = Math.round(stat.size / 1024);
        }
      } catch {}
      return { value: e.name, label: `~/${e.name} (${count} files, ${sizeKb} KB)` };
    });
}

/**
 * Expand ~ in a path string to os.homedir()
 */
function expandTilde(str) {
  if (str === '~') return os.homedir();
  if (str.startsWith('~/')) return path.join(os.homedir(), str.slice(2));
  return str;
}

export async function runConfig() {
  const configPath = defaultConfigPath();
  const existing = readConfig(configPath);

  p.intro('db-backup config wizard');

  // Step 1: Backup destination
  const defaultDest = existing.BACKUP_DEST || '~/OneDrive - Deutsche Bahn/mac-backup';
  const dest = await p.text({
    message: 'Backup destination (path where backups are stored):',
    initialValue: defaultDest,
    validate(value) {
      if (!value.trim()) return 'Destination cannot be empty.';
    },
  });
  if (p.isCancel(dest)) { p.cancel('Setup cancelled.'); process.exit(0); }

  // Step 2: Dotfiles selection (autocompleteMultiselect)
  const homeDir = os.homedir();
  const dotfileOptions = scanDotfiles(homeDir);

  const existingDotfiles = existing.DOTFILES_PATHS
    ? existing.DOTFILES_PATHS.split(' ').filter(Boolean)
    : [];

  const dotfiles = await autocompleteMultiselect({
    message: 'Select dotfiles to backup (type to filter, space to toggle):',
    options: dotfileOptions,
    initialValues: existingDotfiles.length > 0
      ? existingDotfiles
      : dotfileOptions
          .filter(o => ['.zshrc', '.zshenv', '.zprofile', '.gitconfig', '.gitignore_global', '.ssh', '.gnupg', '.config'].includes(o.value))
          .map(o => o.value),
    placeholder: 'Start typing to filter...',
  });
  if (p.isCancel(dotfiles)) { p.cancel('Setup cancelled.'); process.exit(0); }

  // Step 3: GIT_ROOT
  const defaultGitRoot = existing.GIT_ROOT || '~/projects';
  const gitRoot = await p.text({
    message: 'Git root directory (parent directory containing your repos):',
    initialValue: defaultGitRoot,
    validate(value) {
      if (!value.trim()) return 'Git root cannot be empty.';
      const expanded = expandTilde(value.trim());
      if (!fs.existsSync(expanded)) return `Directory does not exist: ${expanded}`;
    },
  });
  if (p.isCancel(gitRoot)) { p.cancel('Setup cancelled.'); process.exit(0); }

  // Step 4: Config preview and write
  // No category toggles — brew/git/dotfiles are always backed up when configured.
  // Presence of DOTFILES_PATHS / GIT_ROOT / brew availability drives what runs.
  const config = {
    BACKUP_DEST: dest,
    DOTFILES_PATHS: dotfiles.join(' '),
    GIT_ROOT: gitRoot,
  };

  const previewLines = Object.entries(config)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  p.note(previewLines, 'Config preview');

  writeConfig(configPath, config);

  p.outro(`Config saved to ${configPath}`);
}
