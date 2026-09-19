import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSafely } from '@kiln/node-adapter';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

export async function runDbMigrate(extraArgs: string[], options: CliOptions): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const envLocal = await parseEnvLocal(rootPath);

  if (options.dryRun) {
    console.log('Dry run: would run `prisma migrate dev` with .env.local loaded');
    return;
  }

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawnSafely('bunx', ['prisma', 'migrate', 'dev', ...extraArgs], {
      cwd: rootPath,
      stdio: 'inherit',
      env: { ...process.env, ...envLocal },
    });

    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });

  process.exitCode = exitCode;
}

async function parseEnvLocal(rootPath: string): Promise<Record<string, string>> {
  let content: string;

  try {
    content = await readFile(join(rootPath, '.env.local'), 'utf8');
  } catch {
    return {};
  }

  const variables: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    variables[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }

  return variables;
}
