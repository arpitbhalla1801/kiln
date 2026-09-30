import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

const JOURNAL_PATH = join('.kiln', 'undo.json');
const JOURNAL_GITIGNORE = join('.kiln', '.gitignore');
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', 'coverage']);

interface JournalEntry {
  path: string;
  /** base64 content before the operation; null when the file did not exist. */
  before: string | null;
  /** sha256 of the content the operation left; null when it deleted the file. */
  afterHash: string | null;
}

interface Journal {
  operation: string;
  timestamp: string;
  files: JournalEntry[];
}

/**
 * Runs `operation` and, if it succeeds and changed any files, replaces the
 * one-deep undo journal with the before-state of every changed file.
 * ponytail: snapshots every project file in memory; fine for app-sized trees,
 * switch to capturing only planned paths if large repos get slow.
 */
export async function withUndoJournal(cwd: string, operation: string, run: () => Promise<void>): Promise<void> {
  const rootPath = await resolveProjectRoot(cwd);
  const before = await snapshot(rootPath);
  await run();
  const after = await snapshot(rootPath);

  const files: JournalEntry[] = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const previous = before.get(path);
    const next = after.get(path);
    if (previous && next && previous.equals(next)) {
      continue;
    }
    files.push({
      path,
      before: previous ? previous.toString('base64') : null,
      afterHash: next ? sha256(next) : null,
    });
  }

  if (files.length === 0) {
    return;
  }

  const journal: Journal = { operation, timestamp: new Date().toISOString(), files };
  await mkdir(join(rootPath, '.kiln'), { recursive: true });
  // The journal holds .env.local contents, so it must never be committed.
  await writeFile(join(rootPath, JOURNAL_GITIGNORE), 'undo.json\n');
  await writeFile(join(rootPath, JOURNAL_PATH), JSON.stringify(journal));
}

export async function runUndo(options: CliOptions): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const raw = await readFile(join(rootPath, JOURNAL_PATH), 'utf8').catch(() => undefined);
  if (!raw) {
    console.log('Nothing to undo.');
    return;
  }
  const journal = JSON.parse(raw) as Journal;

  const changed: string[] = [];
  for (const entry of journal.files) {
    const current = await readFile(join(rootPath, entry.path)).catch(() => undefined);
    if ((current ? sha256(current) : null) !== entry.afterHash) {
      changed.push(entry.path);
    }
  }

  if (changed.length > 0) {
    throw new Error(
      `Refusing to undo '${journal.operation}': these files changed since it ran:\n` +
        changed.map((path) => `  ${path}`).join('\n')
    );
  }

  console.log(`${options.dryRun ? 'Would undo' : 'Undoing'}: ${journal.operation} (${journal.timestamp})`);
  for (const entry of journal.files) {
    const symbol = entry.before === null ? '-' : entry.afterHash === null ? '+' : '~';
    const verb = entry.before === null ? 'delete' : entry.afterHash === null ? 'restore' : 'revert';
    console.log(`  ${symbol} ${verb.padEnd(8)} ${entry.path}`);
  }

  if (options.dryRun) {
    return;
  }

  for (const entry of journal.files) {
    const target = join(rootPath, entry.path);
    if (entry.before === null) {
      await rm(target, { force: true });
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(entry.before, 'base64'));
    }
  }
  await rm(join(rootPath, JOURNAL_PATH), { force: true });

  if (journal.files.some((entry) => entry.path === 'package.json')) {
    console.log('package.json changed: run your package manager install to sync node_modules.');
  }
  console.log('Database migrations and remote data are not rolled back.');
}

async function snapshot(rootPath: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();

  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const path = relative(rootPath, fullPath).split(sep).join('/');
        if (path !== '.kiln/undo.json' && path !== '.kiln/.gitignore') {
          files.set(path, await readFile(fullPath));
        }
      }
    }
  }

  await walk(rootPath);
  return files;
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
