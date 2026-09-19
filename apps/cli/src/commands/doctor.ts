import { readFile } from 'node:fs/promises';
import { connect } from 'node:net';
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

    checks.push(await checkRequiredEnvVars(rootPath));
    checks.push(await checkDatabaseConnectivity(rootPath));

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

async function checkRequiredEnvVars(rootPath: string): Promise<DoctorCheck> {
  const envExamplePath = join(rootPath, '.env.example');
  let content: string;

  try {
    content = await readFile(envExamplePath, 'utf8');
  } catch {
    return { name: 'env-required-vars', status: 'pass', detail: 'no .env.example found' };
  }

  const lines = content.split(/\r?\n/);
  const emptyRequired: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== '# required') {
      continue;
    }

    const nextLine = lines[index + 1] ?? '';
    const separatorIndex = nextLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = nextLine.slice(0, separatorIndex).trim();
    const value = nextLine.slice(separatorIndex + 1).trim();
    if (value === '') {
      emptyRequired.push(key);
    }
  }

  if (emptyRequired.length === 0) {
    return { name: 'env-required-vars', status: 'pass', detail: 'all required vars have a value' };
  }

  return {
    name: 'env-required-vars',
    status: 'warn',
    detail: `missing a value in .env.example: ${emptyRequired.join(', ')}`,
  };
}

// ponytail: TCP reachability only. Credential validity, migration status, and
// required-table checks would need a real DB driver dependency -- add one if
// reachability proves insufficient in practice.
async function checkDatabaseConnectivity(rootPath: string): Promise<DoctorCheck> {
  let content: string;

  try {
    content = await readFile(join(rootPath, '.env.local'), 'utf8');
  } catch {
    return { name: 'database-connectivity', status: 'pass', detail: 'no .env.local found' };
  }

  const match = /^DATABASE_URL=(.+)$/m.exec(content);
  const rawUrl = match?.[1]?.trim();

  if (!rawUrl) {
    return { name: 'database-connectivity', status: 'pass', detail: 'DATABASE_URL not set' };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { name: 'database-connectivity', status: 'warn', detail: 'DATABASE_URL is not a valid URL' };
  }

  const port = url.port ? Number(url.port) : defaultDbPort(url.protocol);
  const reachable = await isHostReachable(url.hostname, port);

  return reachable
    ? { name: 'database-connectivity', status: 'pass', detail: `${url.hostname}:${port} reachable` }
    : {
        name: 'database-connectivity',
        status: 'warn',
        detail: `cannot reach database at ${url.hostname}:${port}`,
      };
}

function defaultDbPort(protocol: string): number {
  if (protocol.startsWith('mysql')) {
    return 3306;
  }
  if (protocol.startsWith('mongodb')) {
    return 27017;
  }
  return 5432;
}

function isHostReachable(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
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
