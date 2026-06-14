import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// --- mock spawn (used by brew via shell.js run()) ---
const mockSpawn = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({ spawn: mockSpawn }));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: { ...actual.default, mkdirSync: mockMkdirSync, existsSync: mockExistsSync },
    ...actual,
    mkdirSync: mockMkdirSync,
    existsSync: mockExistsSync,
  };
});

import { backupBrew, restoreBrew } from '../lib/brew.js';

/** Returns a fake child process that immediately emits 'close' with exit code 0 */
function makeChild(code = 0, signal = null) {
  const child = new EventEmitter();
  child.stdin = null;
  child.stdout = null;
  child.stderr = null;
  // Emit on next tick so the promise has time to set up listeners
  process.nextTick(() => child.emit('close', signal ? null : code, signal));
  return child;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSpawn.mockImplementation(() => makeChild(0));
});

describe('backupBrew', () => {
  it('creates homebrew directory inside dest', async () => {
    await backupBrew('/tmp/backup');
    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/backup/homebrew', { recursive: true });
  });

  it('runs brew bundle dump with correct flags and Brewfile path', async () => {
    await backupBrew('/tmp/backup');
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockSpawn.mock.calls[0];
    expect(cmd).toBe('brew');
    expect(args).toContain('bundle');
    expect(args).toContain('dump');
    expect(args).toContain('--force');
    expect(args).toContain('--no-vscode');
    expect(args.some(a => a.includes('Brewfile'))).toBe(true);
  });
});

describe('restoreBrew', () => {
  it('runs brew bundle install when Brewfile exists', async () => {
    mockExistsSync.mockReturnValue(true);
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
