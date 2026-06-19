/**
 * @file Resolves the path to the opencode executable.
 * Provides a single source of truth for "where is the opencode binary" by
 * combining a user-configured path with a PATH-based fallback (`which`).
 */

import { existsSync, statSync } from 'node:fs';
import { delimiter } from 'node:path';
import which from 'which';

/** Default binary name resolved against PATH when no explicit path is configured. */
export const OPENCODE_BINARY_NAME = 'opencode';

/**
 * Reason a configured or default opencode binary could not be located.
 *
 * - `not-in-path` — no `opencode.executablePath` set and `opencode` is not on PATH.
 * - `config-invalid` — `opencode.executablePath` was set but the file does not exist.
 * - `config-not-executable` — the file exists but is not a regular file the OS can execute
 *   (POSIX only; Windows uses PATHEXT to find executables so this reason is not raised there).
 */
export type NotFoundReason = 'not-in-path' | 'config-invalid' | 'config-not-executable';

/** Result of {@link resolveOpencodeBinary}. */
export type ResolvedBinary =
  | { readonly path: string; readonly source: 'config' | 'path' }
  | {
      readonly path: null;
      readonly source: 'none';
      readonly reason: NotFoundReason;
      readonly configuredPath?: string;
    };

/**
 * Returns true when the path points to a regular file that the OS can execute.
 * On Windows the execute-bit is not enforced (PATHEXT handles resolution), so any
 * existing regular file is considered executable.
 *
 * @param target The absolute path to check.
 * @returns Whether the file is executable on the current platform.
 */
export function isExecutableFile(target: string): boolean {
  if (!target) return false;
  let stat;
  try {
    stat = statSync(target);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  if (process.platform === 'win32') return true;
  // POSIX: any execute bit set makes the file runnable for the current user.
  // Use the user-context bit (mode & 0o100) so files owned by other users with
  // group/world execute still appear runnable to our spawn.
  return (stat.mode & 0o111) !== 0;
}

/**
 * Resolves the opencode binary path using the configured value (highest priority)
 * or a PATH-based lookup as a fallback.
 *
 * Resolution order:
 *  1. If `configuredPath` is non-empty and the file exists at that path → return it as `config`.
 *  2. Else if `which('opencode')` finds a binary on PATH → return it as `path`.
 *  3. Else return a `none` result with a discriminator `reason`.
 *
 * The function never throws; filesystem errors are converted into a `none` result.
 *
 * @param configuredPath The user-configured `opencode.executablePath` (may be empty).
 * @returns A {@link ResolvedBinary} describing the outcome.
 */
export function resolveOpencodeBinary(configuredPath: string): ResolvedBinary {
  const trimmed = configuredPath?.trim() ?? '';

  if (trimmed.length > 0) {
    if (!existsSync(trimmed)) {
      return { path: null, source: 'none', reason: 'config-invalid', configuredPath: trimmed };
    }
    if (!isExecutableFile(trimmed)) {
      return {
        path: null,
        source: 'none',
        reason: 'config-not-executable',
        configuredPath: trimmed,
      };
    }
    return { path: trimmed, source: 'config' };
  }

  let lookup: string | null;
  try {
    // `which` is synchronous when called without a callback. With `nothrow: true`
    // it returns the resolved path or `null` when not found, instead of throwing.
    lookup = which.sync(OPENCODE_BINARY_NAME, { nothrow: true });
  } catch {
    lookup = null;
  }

  if (lookup) {
    return { path: lookup, source: 'path' };
  }

  return { path: null, source: 'none', reason: 'not-in-path' };
}

/**
 * Builds the user-facing message describing why the opencode binary could not be found.
 *
 * @param resolved A `none` result from {@link resolveOpencodeBinary}.
 * @returns A short, single-sentence explanation suitable for a VS Code notification.
 */
export function buildNotFoundMessage(
  resolved: Extract<ResolvedBinary, { source: 'none' }>,
): string {
  switch (resolved.reason) {
    case 'not-in-path':
      return "Could not find the 'opencode' executable in your PATH.";
    case 'config-invalid':
      return `The configured opencode.executablePath does not exist: ${resolved.configuredPath}`;
    case 'config-not-executable':
      return `The configured opencode.executablePath is not executable: ${resolved.configuredPath}`;
  }
}

/**
 * Infers a {@link NotFoundReason} from a spawn-time error emitted by the SDK
 * (`createOpencodeServer`). Used by the activation catch block to give the
 * user a precise recovery message even when the pre-flight check passed but
 * the binary became unreachable or unrunnable between the two calls
 * (e.g. file deleted, permissions changed, server timed out).
 *
 * Resolution rules:
 *  - `EACCES` against a configured path → `config-not-executable` (the file is
 *    there, it just can't be executed).
 *  - `ENOENT` against a configured path → `config-invalid` (the configured
 *    file disappeared between pre-flight and spawn).
 *  - `ENOENT` with no configured path (i.e. PATH lookup) → `not-in-path`.
 *  - `EACCES` with no configured path → `not-in-path` (PATH binary lost its
 *    execute bit; user must reinstall or fix permissions).
 *  - Anything else (including timeouts) → `not-in-path` as the safest default
 *    because it points the user at the install docs and a reload.
 *
 * The function is defensive against non-Error inputs and never throws.
 *
 * @param error The error caught from the SDK call (or the raw value).
 * @param source The binary source from the pre-flight resolution, used to
 *   decide between `config-*` and bare `not-in-path` reasons.
 * @returns The {@link NotFoundReason} that best describes the failure.
 */
export function deriveReasonFromError(
  error: unknown,
  source: 'config' | 'path',
): NotFoundReason {
  const message = error instanceof Error ? error.message : String(error);

  // POSIX error codes bubble up verbatim from cross-spawn via the SDK's
  // `proc.on('error', ...)` handler. Match them at the message level so we
  // don't depend on NodeJS.ErrnoException's exact code field.
  const isEnoent = /\bENOENT\b/.test(message);
  const isEacces = /\bEACCES\b/.test(message);

  if (isEacces && source === 'config') return 'config-not-executable';
  if (isEnoent && source === 'config') return 'config-invalid';
  return 'not-in-path';
}

/**
 * Joins a directory to the existing PATH environment variable, preserving order.
 * Exposed for use by `sdk-client-impl` to prepend the directory of a configured
 * binary so the SDK's `launch('opencode', ...)` can resolve it.
 *
 * @param directory Absolute directory containing the opencode binary.
 * @returns The new PATH value (or undefined if `directory` is empty).
 */
export function joinPath(directory: string): string | undefined {
  if (!directory) return undefined;
  return directory + delimiter + (process.env.PATH ?? '');
}
