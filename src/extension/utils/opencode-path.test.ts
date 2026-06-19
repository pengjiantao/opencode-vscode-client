/**
 * @file Unit tests for opencode-path.ts.
 * Verifies resolution of the opencode binary path through configured path
 * and PATH-based lookup, and the executable-file predicate.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildNotFoundMessage,
  isExecutableFile,
  joinPath,
  resolveOpencodeBinary,
  deriveReasonFromError,
} from './opencode-path';

vi.mock('which', () => {
  return {
    default: {
      sync: vi.fn(),
    },
  };
});

import which from 'which';

const whichSync = which.sync as unknown as ReturnType<typeof vi.fn>;

describe('resolveOpencodeBinary', () => {
  beforeEach(() => {
    whichSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the configured path when it points to an existing executable file', () => {
    // Create a real temp file and make it executable so isExecutableFile passes on POSIX.
    const tmp = path.join(os.tmpdir(), `opencode-${Date.now()}-${Math.random()}.bin`);
    fs.writeFileSync(tmp, '#!/bin/sh\necho ok\n');
    fs.chmodSync(tmp, 0o755);
    try {
      const result = resolveOpencodeBinary(tmp);
      expect(result.source).toBe('config');
      expect(result.path).toBe(tmp);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('returns config-invalid when the configured path does not exist', () => {
    const result = resolveOpencodeBinary('/definitely/not/a/real/path/opencode');
    expect(result.source).toBe('none');
    if (result.source === 'none') {
      expect(result.reason).toBe('config-invalid');
      expect(result.configuredPath).toBe('/definitely/not/a/real/path/opencode');
    }
  });

  it('returns config-not-executable when the configured path is a directory', () => {
    const result = resolveOpencodeBinary(os.tmpdir());
    expect(result.source).toBe('none');
    if (result.source === 'none') {
      expect(result.reason).toBe('config-not-executable');
    }
  });

  it('treats whitespace-only configured paths as empty (falls through to PATH lookup)', () => {
    whichSync.mockReturnValue(null);
    const result = resolveOpencodeBinary('   ');
    expect(result.source).toBe('none');
    if (result.source === 'none') {
      expect(result.reason).toBe('not-in-path');
    }
    // which was consulted because the configured path was empty after trim
    expect(whichSync).toHaveBeenCalledWith('opencode', { nothrow: true });
  });

  it('returns the PATH-resolved binary as source=path when no config is set', () => {
    whichSync.mockReturnValue('/usr/local/bin/opencode');
    const result = resolveOpencodeBinary('');
    expect(result.source).toBe('path');
    expect(result.path).toBe('/usr/local/bin/opencode');
  });

  it('returns not-in-path when neither config nor PATH has the binary', () => {
    whichSync.mockReturnValue(null);
    const result = resolveOpencodeBinary('');
    expect(result.source).toBe('none');
    if (result.source === 'none') {
      expect(result.reason).toBe('not-in-path');
    }
  });

  it('treats which throwing as a not-in-path result (never propagates)', () => {
    whichSync.mockImplementation(() => {
      throw new Error('boom');
    });
    const result = resolveOpencodeBinary('');
    expect(result.source).toBe('none');
    if (result.source === 'none') {
      expect(result.reason).toBe('not-in-path');
    }
  });
});

describe('isExecutableFile', () => {
  it('returns false for empty input', () => {
    expect(isExecutableFile('')).toBe(false);
  });

  it('returns false for non-existent paths', () => {
    expect(isExecutableFile('/no/such/file/abc')).toBe(false);
  });

  it('returns false for directories', () => {
    expect(isExecutableFile(os.tmpdir())).toBe(false);
  });

  it('returns true for executable files on POSIX', () => {
    const tmp = path.join(os.tmpdir(), `opencode-exec-${Date.now()}-${Math.random()}.bin`);
    fs.writeFileSync(tmp, '#!/bin/sh\n');
    fs.chmodSync(tmp, 0o755);
    try {
      expect(isExecutableFile(tmp)).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('returns false for non-executable files on POSIX', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    try {
      const tmp = path.join(os.tmpdir(), `opencode-noexec-${Date.now()}-${Math.random()}.bin`);
      fs.writeFileSync(tmp, 'not executable');
      fs.chmodSync(tmp, 0o644);
      try {
        expect(isExecutableFile(tmp)).toBe(false);
      } finally {
        fs.unlinkSync(tmp);
      }
    } finally {
      platformSpy.mockRestore();
    }
  });

  it('returns true for any existing regular file on Windows (PATHEXT handles resolution)', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    try {
      const tmp = path.join(os.tmpdir(), `opencode-${Date.now()}.bat`);
      fs.writeFileSync(tmp, '@echo off');
      // Even without an executable permission bit (irrelevant on Windows), the file is treated as executable
      try {
        expect(isExecutableFile(tmp)).toBe(true);
      } finally {
        fs.unlinkSync(tmp);
      }
    } finally {
      platformSpy.mockRestore();
    }
  });
});

describe('buildNotFoundMessage', () => {
  it('produces a friendly message for not-in-path', () => {
    const msg = buildNotFoundMessage({ path: null, source: 'none', reason: 'not-in-path' });
    expect(msg).toContain("Could not find the 'opencode' executable");
  });

  it('includes the configured path in the config-invalid message', () => {
    const msg = buildNotFoundMessage({
      path: null,
      source: 'none',
      reason: 'config-invalid',
      configuredPath: '/bad/path',
    });
    expect(msg).toContain('/bad/path');
    expect(msg).toContain('does not exist');
  });

  it('includes the configured path in the config-not-executable message', () => {
    const msg = buildNotFoundMessage({
      path: null,
      source: 'none',
      reason: 'config-not-executable',
      configuredPath: '/non-exec/path',
    });
    expect(msg).toContain('/non-exec/path');
    expect(msg).toContain('not executable');
  });
});

describe('joinPath', () => {
  const originalPath = process.env.PATH;

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  });

  it('returns undefined for empty directory', () => {
    expect(joinPath('')).toBeUndefined();
  });

  it('prepends the directory to the existing PATH', () => {
    process.env.PATH = '/usr/bin';
    const result = joinPath('/custom/bin');
    expect(result).toBe('/custom/bin' + path.delimiter + '/usr/bin');
  });

  it('works when PATH is unset', () => {
    delete process.env.PATH;
    const result = joinPath('/custom/bin');
    expect(result).toBe('/custom/bin' + path.delimiter);
  });
});

describe('deriveReasonFromError', () => {
  it('returns config-not-executable when EACCES hits a configured path', () => {
    // Regression: previously the activation catch block synthesised a
    // not-in-path reason regardless of the actual spawn error, which made
    // the recovery prompt misleading for users with a valid-but-unexecutable
    // configured path (e.g. permissions stripped by a sync tool).
    const err = new Error('spawn /home/user/bin/opencode EACCES');
    expect(deriveReasonFromError(err, 'config')).toBe('config-not-executable');
  });

  it('returns config-invalid when ENOENT hits a configured path', () => {
    // Regression: the binary was found at pre-flight but disappeared before
    // the spawn completed (e.g. a sync tool removed it). Telling the user
    // "not in PATH" is wrong — the file is configured and missing.
    const err = new Error('spawn /home/user/bin/opencode ENOENT');
    expect(deriveReasonFromError(err, 'config')).toBe('config-invalid');
  });

  it('returns not-in-path when ENOENT hits a PATH-sourced binary', () => {
    // The user has no executablePath configured, so the binary is supposed
    // to come from PATH. An ENOENT means it is genuinely not on PATH anymore.
    const err = new Error('spawn opencode ENOENT');
    expect(deriveReasonFromError(err, 'path')).toBe('not-in-path');
  });

  it('returns not-in-path when EACCES hits a PATH-sourced binary', () => {
    // A PATH binary that lost its execute bit is still "missing" from the
    // user's perspective — we tell them to reinstall rather than to fix
    // permissions on a file they don't necessarily know the path of.
    const err = new Error('spawn opencode EACCES');
    expect(deriveReasonFromError(err, 'path')).toBe('not-in-path');
  });

  it('returns not-in-path for timeout errors regardless of source', () => {
    // A timeout is ambiguous (binary started but never printed its banner;
    // wrong binary; hung; etc.). "not-in-path" + a reload is the safest
    // generic nudge.
    const err = new Error('Timeout waiting for server to start after 15000ms');
    expect(deriveReasonFromError(err, 'config')).toBe('not-in-path');
    expect(deriveReasonFromError(err, 'path')).toBe('not-in-path');
  });

  it('returns not-in-path for unknown error shapes', () => {
    // Defensive: a non-Error throwable must not crash the catch block.
    expect(deriveReasonFromError('something weird', 'config')).toBe('not-in-path');
    expect(deriveReasonFromError(undefined, 'path')).toBe('not-in-path');
  });
});
