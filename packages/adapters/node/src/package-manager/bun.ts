import { spawnSafely } from '../spawn-safe.js';
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
  return new Promise((resolve, reject) => {
    const child = spawnSafely(kind, args, {
      cwd,
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

