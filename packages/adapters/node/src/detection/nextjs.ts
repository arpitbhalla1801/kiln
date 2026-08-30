import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NextJsInfo, NextJsRouter } from '../types.js';

export async function detectNextJs(rootPath: string): Promise<NextJsInfo> {
  const packageJson = await readPackageJson(rootPath);
  if (!packageJson) {
    return { detected: false, typescript: false };
  }

  const dependencies = mergeDependencyMaps(packageJson);
  const nextVersion = dependencies.next;
  if (!nextVersion) {
    return { detected: false, typescript: await hasTypeScript(packageJson, rootPath) };
  }

  return {
    detected: true,
    router: await detectRouter(rootPath),
    typescript: await hasTypeScript(packageJson, rootPath),
    version: normalizeVersion(nextVersion),
  };
}

async function detectRouter(rootPath: string): Promise<NextJsRouter> {
  const appRouterPaths = ['app', join('src', 'app')];
  const pagesRouterPaths = ['pages', join('src', 'pages')];

  for (const relativePath of appRouterPaths) {
    if (await pathExists(join(rootPath, relativePath))) {
      return 'app';
    }
  }

  for (const relativePath of pagesRouterPaths) {
    if (await pathExists(join(rootPath, relativePath))) {
      return 'pages';
    }
  }

  return 'unknown';
}

async function hasTypeScript(
  packageJson: Record<string, unknown>,
  rootPath: string
): Promise<boolean> {
  const dependencies = mergeDependencyMaps(packageJson);
  if (dependencies.typescript) {
    return true;
  }

  return await pathExists(join(rootPath, 'tsconfig.json'));
}

function mergeDependencyMaps(packageJson: Record<string, unknown>): Record<string, string> {
  const dependencies = isRecord(packageJson.dependencies) ? packageJson.dependencies : {};
  const devDependencies = isRecord(packageJson.devDependencies)
    ? packageJson.devDependencies
    : {};

  const merged: Record<string, string> = {};
  for (const [name, version] of Object.entries(dependencies)) {
    if (typeof version === 'string') {
      merged[name] = version;
    }
  }

  for (const [name, version] of Object.entries(devDependencies)) {
    if (typeof version === 'string') {
      merged[name] = version;
    }
  }

  return merged;
}

function normalizeVersion(version: string): string {
  return version.replace(/^[\^~]/, '');
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
