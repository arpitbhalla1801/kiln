import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

/**
 * Spawn a command, resolving `.cmd`/`.bat`/`.exe` shims correctly on Windows.
 *
 * Windows package managers (npm, pnpm, yarn) ship as `.cmd` shims, which
 * `child_process.spawn` cannot resolve without a shell — but a bare shell
 * with an args array is unsafe (Node's DEP0190: args are concatenated, not
 * escaped). We use the shell on Windows but quote every argument ourselves
 * so shell metacharacters in a version string or path can't be interpreted.
 *
 * `bun` ships a real `bun.exe`, not a shim, so it never needs the shell.
 * Going through `cmd.exe` anyway adds an extra process in the tree; if the
 * caller times out and kills only the direct child, cmd.exe dies but the
 * bun.exe grandchild it spawned is orphaned and keeps running, still
 * holding files/locks in the very temp dir the next test reuses. Spawning
 * bun directly avoids that process-tree-kill hazard entirely.
 */
export function spawnSafely(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): ChildProcess {
  if (process.platform !== 'win32' || command === 'bun') {
    return spawn(command, args, options);
  }

  // Node's shell + args-array combination triggers DEP0190 regardless of
  // whether the args are already escaped, because Node can't verify that.
  // Building one fully-quoted command string (no separate args array)
  // avoids both the injection risk and the deprecation warning.
  const commandLine = [command, ...args].map(quoteForWindowsShell).join(' ');
  return spawn(commandLine, { ...options, shell: true });
}

function quoteForWindowsShell(arg: string): string {
  if (arg.length > 0 && !/[\s"&|<>^%!]/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '""')}"`;
}
