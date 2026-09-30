import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { runRemove } from '../src/commands/remove.js';
import { runUndo, withUndoJournal } from '../src/commands/undo.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function createProject(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), 'kiln-undo-'));
  tempRoots.push(parent);
  const root = join(parent, 'demo-app');
  await quietly(() => runInit(root, 'demo-app'));
  return root;
}

async function quietly<T>(run: () => Promise<T>): Promise<T> {
  const spy = spyOn(console, 'log').mockImplementation(() => {});
  try {
    return await run();
  } finally {
    spy.mockRestore();
  }
}

/** Every file except the journal itself, as path -> content. */
async function tree(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files: Record<string, string> = {};
  for (const entry of entries) {
    const path = relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/');
    if (entry.isFile() && !path.startsWith('.kiln/undo.json') && path !== '.kiln/.gitignore') {
      files[path] = await readFile(join(root, path), 'utf8');
    }
  }
  return files;
}

const options = (cwd: string, dryRun = false) => ({ cwd, dryRun });

describe('kiln undo', () => {
  test('restores the exact pre-add file state', async () => {
    const root = await createProject();
    const baseline = await tree(root);

    await quietly(() =>
      withUndoJournal(root, 'add env', () => runAdd('env', options(root), { TEST_UNDO: 'value' }))
    );
    expect(await tree(root)).not.toEqual(baseline);
    expect(await readFile(join(root, '.kiln', '.gitignore'), 'utf8')).toBe('undo.json\n');

    await quietly(() => runUndo(options(root, true)));
    expect(await tree(root)).not.toEqual(baseline);

    await quietly(() => runUndo(options(root)));
    expect(await tree(root)).toEqual(baseline);
  }, 60000);

  test('undoes a remove', async () => {
    const root = await createProject();
    await quietly(() => runAdd('env', options(root), { TEST_UNDO: 'value' }));
    const added = await tree(root);

    await quietly(() => withUndoJournal(root, 'remove env', () => runRemove('env', options(root))));
    await quietly(() => runUndo(options(root)));

    expect(await tree(root)).toEqual(added);
  }, 60000);

  test('refuses when a touched file changed since the operation', async () => {
    const root = await createProject();
    await quietly(() =>
      withUndoJournal(root, 'add env', () => runAdd('env', options(root), { TEST_UNDO: 'value' }))
    );
    await writeFile(join(root, '.env.example'), 'EDITED=1\n');

    await expect(quietly(() => runUndo(options(root)))).rejects.toThrow('.env.example');
    expect(await readFile(join(root, '.env.example'), 'utf8')).toBe('EDITED=1\n');
  }, 60000);

  test('reports nothing to undo without a journal', async () => {
    const root = await createProject();
    const lines: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line);
    });
    try {
      await runUndo(options(root));
    } finally {
      spy.mockRestore();
    }
    expect(lines).toEqual(['Nothing to undo.']);
  }, 60000);
});
