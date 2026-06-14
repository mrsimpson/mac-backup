import { describe, it, expect } from 'vitest';
import { q } from '../lib/shell.js';

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
