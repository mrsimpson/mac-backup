import { spawn, execSync } from 'child_process';

/**
 * Check whether dry-run mode is active (env DRY_RUN=true).
 * In dry-run mode no commands are actually executed; they are logged instead.
 */
function isDryRun() {
  return process.env.DRY_RUN === 'true';
}

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
 * In dry-run mode (DRY_RUN=true), logs the command to stderr and
 * resolves immediately with no result — no actual spawning happens.
 *
 * @param {string}   cmd  - Command to run.
 * @param {string[]} args - Argument array (no shell interpolation).
 * @param {object}   [opts] - Options passed to spawn (e.g. { cwd }).
 * @returns {Promise<void>}
 */
export function run(cmd, args, opts = {}) {
  if (isDryRun()) {
    const quoted = [cmd, ...args].map(a => a.includes(' ') ? `'${a}'` : a).join(' ');
    console.error('[DRY-RUN]', quoted);
    return Promise.resolve();
  }

  const { allowedExitCodes = [], ...spawnOpts } = opts;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...spawnOpts });

    child.on('error', reject);

    child.on('close', (code, signal) => {
      if (signal) {
        const err = new Error(`${cmd} killed by signal ${signal}`);
        err.signal = signal;
        reject(err);
      } else if (code !== 0 && !allowedExitCodes.includes(code)) {
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
 * Uses spawn with shell:true. Same async/dry-run behaviour as run().
 *
 * @param {string} shellCmd - Full shell command string (paths must already be quoted with q()).
 * @returns {Promise<void>}
 */
export function runShell(shellCmd, opts = {}) {
  if (isDryRun()) {
    console.error('[DRY-RUN]', shellCmd);
    return Promise.resolve();
  }

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
 * Run a command synchronously and return its stdout (for fast git metadata queries).
 *
 * In dry-run mode, returns an empty string so callers get graceful defaults
 * (no remotes, branch 'unknown', no changes, no unpushed commits) via their
 * existing try/catch or empty-string checks.
 *
 * @param {string} cmd  - Shell command string.
 * @param {object} opts - Options passed to execSync (encoding, stdio).
 * @returns {string}
 */
export function runSync(cmd, opts = {}) {
  if (isDryRun()) {
    console.error('[DRY-RUN]', cmd);
    return '';
  }

  return execSync(cmd, opts);
}


