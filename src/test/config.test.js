import { describe, it, expect, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import crypto from 'crypto';
import { readConfig, writeConfig, defaultConfigPath } from '../lib/config.js';

const tmpFiles = [];

function makeTmpFile() {
  const file = join(tmpdir(), `config-test-${crypto.randomUUID()}.env`);
  tmpFiles.push(file);
  return file;
}

afterEach(() => {
  for (const f of tmpFiles.splice(0)) {
    if (existsSync(f)) {
      try { unlinkSync(f); } catch {}
    }
  }
});

describe('readConfig / writeConfig', () => {
  it('round-trip: write then read returns same object', () => {
    const tmpFile = makeTmpFile();
    const config = { BACKUP_DEST: '/tmp/foo', GPG_KEY: 'ABC123' };
    writeConfig(tmpFile, config);
    const result = readConfig(tmpFile);
    expect(result).toEqual(config);
  });

  it('tilde expansion: ~ in value is expanded to HOME', () => {
    const tmpFile = makeTmpFile();
    writeFileSync(tmpFile, 'BACKUP_DEST=~/foo\n', 'utf8');
    const result = readConfig(tmpFile);
    expect(result.BACKUP_DEST).toBe(`${process.env.HOME}/foo`);
  });

  it('missing file: returns empty object (no throw)', () => {
    const result = readConfig('/nonexistent/path/config-xyz-does-not-exist');
    expect(result).toEqual({});
  });

  it('comment skip: lines starting with # are ignored', () => {
    const tmpFile = makeTmpFile();
    writeFileSync(tmpFile, '# this is a comment\nKEY=val\n', 'utf8');
    const result = readConfig(tmpFile);
    expect(result).toEqual({ KEY: 'val' });
  });

  it('empty lines are skipped', () => {
    const tmpFile = makeTmpFile();
    writeFileSync(tmpFile, '\nKEY=val\n\n', 'utf8');
    const result = readConfig(tmpFile);
    expect(result).toEqual({ KEY: 'val' });
  });

  it('value with = sign: splits on first = only', () => {
    const tmpFile = makeTmpFile();
    writeFileSync(tmpFile, 'URL=http://example.com/path?a=1&b=2\n', 'utf8');
    const result = readConfig(tmpFile);
    expect(result).toEqual({ URL: 'http://example.com/path?a=1&b=2' });
  });
});

describe('defaultConfigPath', () => {
  it('returns a string ending with .backup-config', () => {
    const p = defaultConfigPath();
    expect(typeof p).toBe('string');
    expect(p.endsWith('.backup-config')).toBe(true);
  });

  it('is under HOME directory', () => {
    const p = defaultConfigPath();
    expect(p.startsWith(process.env.HOME)).toBe(true);
  });
});
