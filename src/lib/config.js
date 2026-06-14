import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Parse a dotenv file into a plain object.
 * - Skips empty lines and lines starting with #
 * - Splits on first = only
 * - Expands ~ to process.env.HOME in values
 * - Returns {} if file does not exist
 */
export function readConfig(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf8');
  const result = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Expand ~ to HOME
    if (value.startsWith('~/') || value === '~') {
      value = process.env.HOME + value.slice(1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Serialize a plain object to dotenv key=value lines and write to file.
 * Creates parent directory if needed.
 * No quoting of values.
 */
export function writeConfig(filePath, obj) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines = Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  writeFileSync(filePath, lines + '\n', 'utf8');
}

/**
 * Returns the default config file path: $HOME/.backup-config
 */
export function defaultConfigPath() {
  return join(process.env.HOME, '.backup-config');
}
