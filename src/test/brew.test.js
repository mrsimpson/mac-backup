import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// --- mock spawn (used by brew via shell.js run()/capture()) ---
const mockSpawn = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({ spawn: mockSpawn }));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: { ...actual.default, mkdirSync: mockMkdirSync, existsSync: mockExistsSync, writeFileSync: mockWriteFileSync },
    ...actual,
    mkdirSync: mockMkdirSync,
    existsSync: mockExistsSync,
    writeFileSync: mockWriteFileSync,
  };
});

import { backupBrew, restoreBrew } from '../lib/brew.js';

/** Returns a fake child process that emits 'close' with exit code 0 and optional stdout data */
function makeChild(code = 0, stdoutData = '') {
  const child = new EventEmitter();
  child.stdin = null;
  child.stdout = new EventEmitter();
  child.stderr = null;
  process.nextTick(() => {
    if (stdoutData) child.stdout.emit('data', Buffer.from(stdoutData));
    child.emit('close', code, null);
  });
  return child;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('backupBrew', () => {
  it('creates homebrew directory inside dest', async () => {
    mockSpawn.mockImplementation(() => makeChild(0, ''));
    await backupBrew('/tmp/backup');
    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/backup/homebrew', { recursive: true });
  });

  it('calls brew tap, brew leaves, and brew list --cask', async () => {
    mockSpawn.mockImplementation((cmd, args) => {
      if (args[0] === 'tap') return makeChild(0, 'homebrew/core\n');
      if (args[0] === 'leaves') return makeChild(0, 'git\nnpm\n');
      if (args[1] === '--cask') return makeChild(0, 'firefox\n');
      return makeChild(0, '');
    });

    await backupBrew('/tmp/backup');

    const calls = mockSpawn.mock.calls.map(([, args]) => args);
    expect(calls).toContainEqual(['tap']);
    expect(calls).toContainEqual(['leaves']);
    expect(calls).toContainEqual(['list', '--cask']);
  });

  it('writes a Brewfile containing taps, formulae, and casks', async () => {
    mockSpawn.mockImplementation((cmd, args) => {
      if (args[0] === 'tap') return makeChild(0, 'homebrew/core\n');
      if (args[0] === 'leaves') return makeChild(0, 'git\nnpm\n');
      if (args[1] === '--cask') return makeChild(0, 'firefox\n');
      return makeChild(0, '');
    });

    await backupBrew('/tmp/backup');

    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [filePath, content] = mockWriteFileSync.mock.calls[0];
    expect(filePath).toBe('/tmp/backup/homebrew/Brewfile');
    expect(content).toContain('tap "homebrew/core"');
    expect(content).toContain('brew "git"');
    expect(content).toContain('brew "npm"');
    expect(content).toContain('cask "firefox"');
  });

  it('handles empty output gracefully (no section with zero entries)', async () => {
    mockSpawn.mockImplementation(() => makeChild(0, ''));
    await backupBrew('/tmp/backup');
    const [, content] = mockWriteFileSync.mock.calls[0];
    expect(content.trim()).toBe('');
  });
});

describe('restoreBrew', () => {
  it('runs brew bundle install when Brewfile exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockSpawn.mockImplementation(() => makeChild(0));
    await restoreBrew('/tmp/backup');
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockSpawn.mock.calls[0];
    expect(cmd).toBe('brew');
    expect(args).toContain('bundle');
    expect(args).toContain('install');
    expect(args.some(a => a.includes('Brewfile'))).toBe(true);
  });

  it('throws an error when no Brewfile is found', async () => {
    mockExistsSync.mockReturnValue(false);
    await expect(restoreBrew('/tmp/backup')).rejects.toThrow('No Brewfile found');
  });
});
