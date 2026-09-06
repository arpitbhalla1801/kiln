import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeAdapter, spawnSafely } from '@kiln/node-adapter';
import { OwnershipMetadataStore } from '@kiln/project-model';
import { resolveProjectRoot } from '../project.js';
import type { CliOptions } from '../output.js';
import { expectsNextJsProject } from '../validation/nextjs-project.js';
import { validatePackageJson } from '../validation/package-json.js';

interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

export async function runDoctor(options: CliOptions): Promise<void> {
  const checks: DoctorCheck[] = [];

  checks.push(await checkBunInstalled());

  try {
    const rootPath = await resolveProjectRoot(options.cwd);
    const adapter = new NodeAdapter();
    const inspection = await adapter.inspect(rootPath);

    checks.push({
      name: 'package.json',
      status: inspection.filesystem.packageJson ? 'pass' : 'fail',
      detail: inspection.filesystem.packageJson ? 'found' : 'missing',
    });

    if (inspection.filesystem.packageJson) {
      checks.push(await checkPackageJsonHealth(rootPath));
    }

    checks.push({
      name: 'package-manager',
      status: inspection.packageManager.installed ? 'pass' : 'fail',
      detail: `${inspection.packageManager.kind} ${inspection.packageManager.installed ? 'available' : 'missing'}`,
    });

    if (inspection.filesystem.lockfile) {
      checks.push({
        name: 'lockfile',
        status: 'pass',
        detail: inspection.filesystem.lockfile,
      });
    } else {
      checks.push({
        name: 'lockfile',
        status: 'warn',
        detail: 'no lockfile detected',
      });
    }

    if (await OwnershipMetadataStore.exists(rootPath)) {
      checks.push({
        name: 'ownership',
        status: 'pass',
        detail: '.kiln/ownership.json present',
      });
    } else {
      checks.push({
        name: 'ownership',
        status: 'warn',
        detail: '.kiln/ownership.json not found',
      });
    }
  } catch (error) {
    checks.push({
      name: 'project',
      status: 'fail',
      detail: error instanceof Error ? error.message : 'project validation failed',
    });
  }

  console.log('Kiln doctor');
  let failures = 0;

  for (const check of checks.sort((left, right) => left.name.localeCompare(right.name))) {
    console.log(`  [${check.status}] ${check.name}: ${check.detail}`);
    if (check.status === 'fail') {
      failures += 1;
    }
  }

  if (failures > 0) {
    throw new Error(`Doctor found ${failures} failing check(s)`);
  }
}

async function checkPackageJsonHealth(rootPath: string): Promise<DoctorCheck> {
  const packageJsonPath = join(rootPath, 'package.json');
  const content = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(content) as Record<string, unknown>;
  const validation = validatePackageJson(packageJson, {
    expectsNextJs: await expectsNextJsProject(rootPath),
  });

  return {
    name: 'package-json-health',
    status: validation.status,
    detail: validation.detail,
  };
}

async function checkBunInstalled(): Promise<DoctorCheck> {
  const exitCode = await runCommand('bun', ['--version']);

  return {
    name: 'bun',
    status: exitCode === 0 ? 'pass' : 'fail',
    detail: exitCode === 0 ? 'installed' : 'not available',
  };
}

function runCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawnSafely(command, args, {
      stdio: 'ignore',
    });

    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}
