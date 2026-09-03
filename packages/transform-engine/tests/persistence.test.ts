import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FilesystemPersistence } from '../src/persistence.js';
import { VirtualFilesystem } from '../src/vfs.js';

describe('FilesystemPersistence', () => {
  const testDir = path.join(__dirname, 'persistence-output');
  const persistence = new FilesystemPersistence();

  beforeAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('commits vfs mutations to disk in deterministic order', async () => {
    const vfs = new VirtualFilesystem();
    vfs.write('z.ts', 'z');
    vfs.write('a.ts', 'a');
    vfs.write('m.ts', 'm');

    const result = await persistence.persistVirtualFilesystem(vfs, { rootDir: testDir });

    expect(result.written.map((filePath) => path.basename(filePath))).toEqual(['a.ts', 'm.ts', 'z.ts']);
    expect(await fs.readFile(path.join(testDir, 'a.ts'), 'utf8')).toBe('a');
    expect(await fs.readFile(path.join(testDir, 'z.ts'), 'utf8')).toBe('z');
  });

  test('applies safe overwrite for modify operations', async () => {
    const targetPath = path.join(testDir, 'overwrite.txt');
    await fs.writeFile(targetPath, 'original', 'utf8');

    await persistence.persistOperations(
      [{ type: 'modify', filePath: targetPath, content: 'updated' }],
      { rootDir: testDir }
    );

    expect(await fs.readFile(targetPath, 'utf8')).toBe('updated');
  });

  test('deletes files after writes complete', async () => {
    const keepPath = path.join(testDir, 'keep.txt');
    const removePath = path.join(testDir, 'remove.txt');
    await fs.writeFile(keepPath, 'keep', 'utf8');
    await fs.writeFile(removePath, 'remove', 'utf8');

    await persistence.persistOperations(
      [
        { type: 'modify', filePath: keepPath, content: 'kept' },
        { type: 'delete', filePath: removePath },
      ],
      { rootDir: testDir }
    );

    expect(await fs.readFile(keepPath, 'utf8')).toBe('kept');
    await expect(fs.access(removePath)).rejects.toThrow();
  });

  test('leaves no temp files after successful persistence', async () => {
    await persistence.persistOperations(
      [
        { type: 'create', filePath: 'clean.txt', content: 'clean' },
        { type: 'create', filePath: 'nested/dir/file.txt', content: 'nested' },
      ],
      { rootDir: testDir }
    );

    const files = await listFilesRecursive(testDir);
    expect(files.some((file) => file.includes('.kiln.tmp'))).toBe(false);
  });

  test('prevents partial temp artifacts when persistence fails', async () => {
    const blockerPath = path.join(testDir, 'blocker.txt');
    await fs.writeFile(blockerPath, 'blocker', 'utf8');

    const safePath = 'aaa-safe.txt';
    const originalPath = path.join(testDir, safePath);
    await fs.writeFile(originalPath, 'safe-original', 'utf8');

    await expect(
      persistence.persistOperations(
        [
          { type: 'modify', filePath: safePath, content: 'safe-updated' },
          {
            type: 'create',
            filePath: path.join('blocker.txt', 'nested.txt'),
            content: 'should-fail',
          },
        ],
        { rootDir: testDir }
      )
    ).rejects.toThrow();

    const files = await listFilesRecursive(testDir);
    expect(files.some((file) => file.includes('.kiln.tmp'))).toBe(false);
    expect(await fs.readFile(originalPath, 'utf8')).toBe('safe-updated');
  });

  test('supports absolute file paths', async () => {
    const absolutePath = path.join(testDir, 'absolute.txt');

    await persistence.persistOperations(
      [{ type: 'create', filePath: absolutePath, content: 'absolute' }],
      { rootDir: testDir }
    );

    expect(await fs.readFile(absolutePath, 'utf8')).toBe('absolute');
  });
});

async function listFilesRecursive(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}
