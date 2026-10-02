import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { LOCKFILES } from '@kiln-cli/node-adapter';
import {
  FILE_HASHES_FILE,
  KILN_DIRECTORY,
  LOCKFILE_FILE,
  OWNERSHIP_METADATA_FILE,
} from '@kiln-cli/project-model';
import { onBeforePersist } from '@kiln-cli/transform-engine';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

const JOURNAL_PATH = join(KILN_DIRECTORY, 'undo.json');
const JOURNAL_GITIGNORE = join(KILN_DIRECTORY, '.gitignore');

/**
 * Files kiln changes outside the transform engine: its own metadata, and what
 * a dependency install rewrites. Everything else is captured as the engine
 * persists it.
 */
const FILES_WRITTEN_OUTSIDE_ENGINE = [
  ...[OWNERSHIP_METADATA_FILE, LOCKFILE_FILE, FILE_HASHES_FILE].map((file) => `${KILN_DIRECTORY}/${file}`),
  'package.json',
  ...LOCKFILES.map((lockfile) => lockfile.file),
];

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
 * one-deep undo journal with the before-state of every changed file. Reads
 * only files kiln is about to write, never the whole project.
 */
export async function withUndoJournal(cwd: string, operation: string, run: () => Promise<void>): Promise<void> {
  const rootPath = await resolveProjectRoot(cwd);
  const before = new Map<string, Buffer | undefined>();
  const capture = async (absolutePath: string): Promise<void> => {
    const path = relative(rootPath, absolutePath).split(sep).join('/');
    if (!before.has(path)) {
      before.set(path, await readFile(absolutePath).catch(() => undefined));
    }
  };

  for (const path of FILES_WRITTEN_OUTSIDE_ENGINE) {
    await capture(join(rootPath, path));
  }
  onBeforePersist(capture);
  try {
    await run();
  } finally {
    onBeforePersist(undefined);
  }

  const files: JournalEntry[] = [];
  for (const [path, previous] of before) {
    const next = await readFile(join(rootPath, path)).catch(() => undefined);
    if (previous === next || (previous && next && previous.equals(next))) {
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
  await mkdir(join(rootPath, KILN_DIRECTORY), { recursive: true });
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
      await removeEmptyParents(rootPath, entry.path);
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(entry.before, 'base64'));
    }
  }
  await rm(join(rootPath, JOURNAL_PATH), { force: true });
  await rm(join(rootPath, JOURNAL_GITIGNORE), { force: true });
  await removeEmptyParents(rootPath, JOURNAL_PATH);

  if (journal.files.some((entry) => entry.path === 'package.json')) {
    console.log('package.json changed: run your package manager install to sync node_modules.');
  }
  console.log('Database migrations and remote data are not rolled back.');
}

/** Removes directories left empty by deleting `path`; rmdir refuses non-empty ones. */
async function removeEmptyParents(rootPath: string, path: string): Promise<void> {
  for (let directory = dirname(path); directory !== '.'; directory = dirname(directory)) {
    try {
      await rmdir(join(rootPath, directory));
    } catch {
      return;
    }
  }
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
