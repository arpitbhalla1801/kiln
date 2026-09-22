import { spawnSafely } from '../spawn-safe.js';
import type { CommandResult, DependencyInstallOptions } from '../types.js';
import type { PackageManagerKind } from '../types.js';

const DEV_FLAG: Record<PackageManagerKind, string> = {
  bun: '--dev',
  npm: '--save-dev',
  pnpm: '--save-dev',
  yarn: '--dev',
};

export async function bunAdd(
  rootPath: string,
  dependencies: Record<string, string>,
  options: DependencyInstallOptions = {}
): Promise<CommandResult> {
  return packageManagerAdd(rootPath, 'bun', dependencies, options);
}

export function buildAddArgs(
  kind: PackageManagerKind,
  dependencies: Record<string, string>,
  options: DependencyInstallOptions = {}
): string[] {
  const args = [kind === 'npm' ? 'install' : 'add'];
  if (options.dev) {
    args.push(DEV_FLAG[kind]);
  }

  for (const [name, version] of Object.entries(dependencies)) {
    args.push(version ? `${name}@${version}` : name);
  }

  return args;
}

export async function packageManagerAdd(
  rootPath: string,
  kind: PackageManagerKind,
  dependencies: Record<string, string>,
  options: DependencyInstallOptions = {}
): Promise<CommandResult> {
  return runPackageManager(kind, buildAddArgs(kind, dependencies, options), rootPath);
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

