import { spawn } from 'child_process';

/**
 * Shell-quote a single path for safe interpolation into a shell command string.
 * Wraps the path in single-quotes and escapes any embedded single-quotes
 * using the standard '\'' trick.
 *
 * @param {string} p - The path (or any string) to quote.
 * @returns {string}
 */
export function q(p) {
  return "'" + String(p).replace(/'/g, "'\\''") + "'";
}

/**
 * Run a command asynchronously, inheriting stdio so the user sees output
 * and Ctrl+C is forwarded to the child process naturally.
 *
 * Returns a promise that:
 *   - resolves with exit code 0 on success
 *   - rejects with an Error on non-zero exit or signal termination
 *     (error.signal is set when killed by a signal)
 *
 * Because spawn is non-blocking, Node's event loop stays alive during
 * execution — SIGINT (Ctrl+C) is handled normally by Node and the child
 * process receives it through the shared process group.
 *
 * @param {string}   cmd  - Command to run.
 * @param {string[]} args - Argument array (no shell interpolation).
 * @param {object}   [opts] - Options passed to spawn (e.g. { cwd }).
 * @returns {Promise<void>}
 */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });

    child.on('error', reject);

    child.on('close', (code, signal) => {
      if (signal) {
        const err = new Error(`${cmd} killed by signal ${signal}`);
        err.signal = signal;
        reject(err);
      } else if (code !== 0) {
        const err = new Error(`${cmd} exited with code ${code}`);
        err.exitCode = code;
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Run a shell pipeline or command that requires shell features (pipes, redirects).
 * Uses spawn with shell:true. Same async/SIGINT behaviour as run().
 *
 * @param {string} shellCmd - Full shell command string (paths must already be quoted with q()).
 * @returns {Promise<void>}
 */
export function runShell(shellCmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(shellCmd, { stdio: 'inherit', shell: true, ...opts });

    child.on('error', reject);

    child.on('close', (code, signal) => {
      if (signal) {
        const err = new Error(`Command killed by signal ${signal}: ${shellCmd}`);
        err.signal = signal;
        reject(err);
      } else if (code !== 0) {
        const err = new Error(`Command failed (exit ${code}): ${shellCmd}`);
        err.exitCode = code;
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Run a command and capture its stdout as a string (for git metadata queries).
 * Uses execSync — only appropriate for fast, non-interactive commands.
 * Still used for git metadata (remote -v, status --porcelain, etc.) because
 * those complete in milliseconds and don't need async.
 *
 * @param {string} cmd - Shell command string.
 * @returns {string}
 */
export { execSync as runSync } from 'child_process';
