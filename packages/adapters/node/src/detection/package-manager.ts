import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { PackageManagerInfo, PackageManagerKind } from '../types.js';

const LOCKFILES: Array<{ file: string; kind: PackageManagerKind }> = [
  { file: 'bun.lock', kind: 'bun' },
  { file: 'bun.lockb', kind: 'bun' },
  { file: 'package-lock.json', kind: 'npm' },
  { file: 'pnpm-lock.yaml', kind: 'pnpm' },
  { file: 'yarn.lock', kind: 'yarn' },
];

export async function detectPackageManager(rootPath: string): Promise<PackageManagerInfo> {
  const packageJson = await readPackageJson(rootPath);
  const declaredManager = readDeclaredPackageManager(packageJson);

  for (const lockfile of LOCKFILES) {
    if (await pathExists(join(rootPath, lockfile.file))) {
      return {
        kind: lockfile.kind,
        lockfile: lockfile.file,
        installed: await isPackageManagerInstalled(lockfile.kind),
      };
    }
  }

  if (declaredManager) {
    return {
      kind: declaredManager,
      installed: await isPackageManagerInstalled(declaredManager),
    };
  }

  return {
    kind: 'bun',
    installed: await isPackageManagerInstalled('bun'),
  };
}

export async function detectLockfile(rootPath: string): Promise<string | undefined> {
  for (const lockfile of LOCKFILES) {
    if (await pathExists(join(rootPath, lockfile.file))) {
      return lockfile.file;
    }
  }

  return undefined;
}

async function readPackageJson(rootPath: string): Promise<Record<string, unknown> | null> {
  const packageJsonPath = join(rootPath, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  const content = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

function readDeclaredPackageManager(
  packageJson: Record<string, unknown> | null
): PackageManagerKind | undefined {
  const packageManager = packageJson?.packageManager;
  if (typeof packageManager !== 'string') {
    return undefined;
  }

  const [name] = packageManager.split('@');
  if (name === 'bun' || name === 'npm' || name === 'pnpm' || name === 'yarn') {
    return name;
  }

  return undefined;
}

async function isPackageManagerInstalled(kind: PackageManagerKind): Promise<boolean> {
  const command = process.platform === 'win32' ? `${kind}.cmd` : kind;

  try {
    const result = await runCommand(command, ['--version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function runCommand(command: string, args: string[]): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? 1 });
    });
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
