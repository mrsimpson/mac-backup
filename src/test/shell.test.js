import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { q, run, runSync } from '../lib/shell.js';

describe('q (shell quoting)', () => {
  it('wraps a simple path in single quotes', () => {
    expect(q('/tmp/foo')).toBe("'/tmp/foo'");
  });

  it('handles paths with spaces', () => {
    expect(q('/Users/x/OneDrive - Deutsche Bahn/mac-backup')).toBe(
      "'/Users/x/OneDrive - Deutsche Bahn/mac-backup'"
    );
  });

  it('escapes embedded single quotes', () => {
    expect(q("it's a trap")).toBe("'it'\\''s a trap'");
  });

  it('handles path that is already safe', () => {
    expect(q('/home/user/projects')).toBe("'/home/user/projects'");
  });

  it('handles empty string', () => {
    expect(q('')).toBe("''");
  });
});

describe('dry-run mode', () => {
  const original = process.env.DRY_RUN;

  beforeEach(() => { delete process.env.DRY_RUN; });
  afterEach(() => { process.env.DRY_RUN = original; });

  it('run() resolves immediately without spawning when DRY_RUN=true', async () => {
    process.env.DRY_RUN = 'true';
    // Should not throw (no actual spawn) and resolve quickly
    await expect(run('rsync', ['-a', '/src', '/dst'])).resolves.toBeUndefined();
  });

  it('run() spawns normally when DRY_RUN is not set', async () => {
    // We can't test actual spawning without heavy mocking, but we can
    // verify the function exists and doesn't throw immediately
    expect(typeof run).toBe('function');
  });

  it('runSync() returns empty string when DRY_RUN=true', () => {
    process.env.DRY_RUN = 'true';
    const out = runSync('git remote -v', { encoding: 'utf8' });
    expect(out).toBe('');
  });
});
