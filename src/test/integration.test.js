import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binaryPath = path.join(__dirname, '../../mac-backup');

function runBinary(args = []) {
  return spawnSync('node', [binaryPath, ...args], {
    encoding: 'utf8',
    timeout: 5000,
  });
}

describe('mac-backup binary', () => {
  it('exits 1 with usage when no args provided', () => {
    const result = runBinary([]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Usage');
  });

  it('exits 1 with usage for unknown subcommand', () => {
    const result = runBinary(['unknown-subcommand']);
    expect(result.status).toBe(1);
    // Should show usage or "Unknown" message
    expect(result.stdout + result.stderr).toMatch(/usage|unknown/i);
  });

  it('exits 1 for "foobar" subcommand', () => {
    const result = runBinary(['foobar']);
    expect(result.status).toBe(1);
  });
});
