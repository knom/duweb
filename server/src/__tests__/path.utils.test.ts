import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { escapeRegExp, expandHomePath } from '../utils/path.js';

describe('path utils', () => {
  it('expands ~ to the user home directory', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/tester');

    expect(expandHomePath('~')).toBe('/home/tester');
    expect(expandHomePath(`~${path.sep}docs`)).toBe(path.join('/home/tester', 'docs'));
  });

  it('returns unchanged values when no home prefix is used', () => {
    expect(expandHomePath('/var/tmp')).toBe('/var/tmp');
    expect(expandHomePath('relative/path')).toBe('relative/path');
  });

  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a+b*c?.[x]')).toBe('a\\+b\\*c\\?\\.\\[x\\]');
    expect(escapeRegExp('^path$(test)|foo')).toBe('\\^path\\$\\(test\\)\\|foo');
  });
});
