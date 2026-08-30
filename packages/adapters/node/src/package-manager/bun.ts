import { spawn } from 'node:child_process';
import type { CommandResult, DependencyInstallOptions } from '../types.js';
import type { PackageManagerKind } from '../types.js';

export async function bunAdd(
  rootPath: string,
  dependencies: Record<string, string>,
  options: DependencyInstallOptions = {}
): Promise<CommandResult> {
  const args = ['add'];
  if (options.dev) {
    args.push('--dev');
  }

  for (const [name, version] of Object.entries(dependencies)) {
    args.push(version ? `${name}@${version}` : name);
  }

  return runPackageManager('bun', args, rootPath);
}

export async function bunRemove(rootPath: string, names: string[]): Promise<CommandResult> {
  return runPackageManager('bun', ['remove', ...names], rootPath);
}

export async function runPackageManagerScript(
  rootPath: string,
  kind: PackageManagerKind,
  script: string,
  args: string[] = []
): Promise<CommandResult> {
  if (kind === 'bun') {
    return runPackageManager('bun', ['run', script, ...args], rootPath);
  }

  return runPackageManager(kind, ['run', script, '--', ...args], rootPath);
}

async function runPackageManager(
  kind: PackageManagerKind,
  args: string[],
  cwd: string
): Promise<CommandResult> {
  const command = resolveCommand(kind);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function resolveCommand(kind: PackageManagerKind): string {
  if (process.platform === 'win32') {
    return `${kind}.cmd`;
  }

  return kind;
}
