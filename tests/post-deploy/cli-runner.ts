import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(testsDir, '../..');
export const cliBin = join(repoRoot, 'apps/cli/dist/index.js');
export const exampleAppRoot = join(repoRoot, 'examples/nextjs-app');

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  output: string;
}

export function assertBuiltCli(): void {
  try {
    accessSync(cliBin);
  } catch {
    throw new Error(
      `Built kiln CLI not found at ${cliBin}. Run \`bun run build\` before post-deploy tests.`
    );
  }
}

export function runKiln(args: string[], cwd = repoRoot): CliResult {
  assertBuiltCli();

  const result = spawnSync('bun', [cliBin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  return {
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
}

export function runCommand(command: string, args: string[], cwd: string): CliResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  return {
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
}
