import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AdapterContract } from '@kiln/core';
import { detectNextJs } from './detection/nextjs.js';
import { detectLockfile, detectPackageManager } from './detection/package-manager.js';
import { bunAdd, bunRemove, runPackageManagerScript } from './package-manager/bun.js';
import type {
  CommandResult,
  DependencyInstallOptions,
  FilesystemExpectations,
  NodeAdapterRuntime,
  ProjectInspection,
} from './types.js';

export class NodeAdapter implements AdapterContract, NodeAdapterRuntime {
  readonly id = 'node-adapter';
  readonly version = '1.0.0';
  readonly provides = [
    'package-manager',
    'filesystem',
    'script-runner',
    'project-inspection',
    'nextjs-detection',
  ];

  async inspect(rootPath: string): Promise<ProjectInspection> {
    const packageManager = await detectPackageManager(rootPath);
    const nextjs = await detectNextJs(rootPath);
    const filesystem = await this.getFilesystemExpectations(rootPath);
    const packageJson = await readPackageJson(rootPath);

    return {
      rootPath,
      packageManager,
      nextjs,
      filesystem,
      hasPackageJson: filesystem.packageJson,
      hasTypeScript: nextjs.typescript,
      packageName: typeof packageJson?.name === 'string' ? packageJson.name : undefined,
      packageVersion:
        typeof packageJson?.version === 'string' ? packageJson.version : undefined,
    };
  }

  async getFilesystemExpectations(rootPath: string): Promise<FilesystemExpectations> {
    const packageJson = await pathExists(join(rootPath, 'package.json'));
    const nodeModules = await pathExists(join(rootPath, 'node_modules'));
    const lockfile = await detectLockfile(rootPath);

    return {
      packageJson,
      nodeModules,
      lockfile,
    };
  }

  async installDependencies(
    rootPath: string,
    dependencies: Record<string, string>,
    options?: DependencyInstallOptions
  ): Promise<CommandResult> {
    const packageManager = await detectPackageManager(rootPath);
    if (packageManager.kind !== 'bun') {
      throw new Error(
        `Unsupported package manager '${packageManager.kind}'. Bun integration is required for installs.`
      );
    }

    return bunAdd(rootPath, dependencies, options ?? {});
  }

  async removeDependencies(rootPath: string, names: string[]): Promise<CommandResult> {
    const packageManager = await detectPackageManager(rootPath);
    if (packageManager.kind !== 'bun') {
      throw new Error(
        `Unsupported package manager '${packageManager.kind}'. Bun integration is required for removals.`
      );
    }

    return bunRemove(rootPath, names);
  }

  async runScript(rootPath: string, script: string, args: string[] = []): Promise<CommandResult> {
    const packageManager = await detectPackageManager(rootPath);
    return runPackageManagerScript(rootPath, packageManager.kind, script, args);
  }
}

async function readPackageJson(rootPath: string): Promise<Record<string, unknown> | null> {
  const packageJsonPath = join(rootPath, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  const content = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
