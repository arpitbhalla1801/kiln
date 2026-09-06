import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { RollbackManager } from '../src/rollback.js';
import { TransformEngine } from '../src/engine.js';
import { VirtualFilesystem } from '../src/vfs.js';
import { fileCreate } from '../src/transform-builders.js';
import type { FilesystemPersistence } from '../src/persistence.js';

describe('RollbackManager', () => {
  const testDir = path.join(__dirname, 'rollback-output');
  const rollbackManager = new RollbackManager();

  beforeAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('creates and restores virtual filesystem snapshots', () => {
    const vfs = new VirtualFilesystem({ initialFiles: { 'keep.ts': 'keep' } });
    vfs.write('new.ts', 'new');

    const snapshot = rollbackManager.createSnapshot(vfs);
    vfs.write('keep.ts', 'changed');
    vfs.delete('new.ts');

    rollbackManager.restoreVirtualFilesystem(vfs, snapshot);

    expect(vfs.read('keep.ts')).toBe('keep');
    expect(vfs.read('new.ts')).toBe('new');
  });

  test('captures and rolls back disk file state', async () => {
    const existingPath = path.join(testDir, 'existing.txt');
    await fs.writeFile(existingPath, 'original', 'utf8');

    const vfs = new VirtualFilesystem();
    vfs.write(path.join(testDir, 'existing.txt'), 'modified');
    vfs.write(path.join(testDir, 'created.txt'), 'created');

    const diff = vfs.getDiff();
    const diskSnapshots = await rollbackManager.captureDiskSnapshots(testDir, diff);
    const snapshot = rollbackManager.createSnapshot(vfs, diskSnapshots);

    await fs.writeFile(existingPath, 'modified', 'utf8');
    await fs.writeFile(path.join(testDir, 'created.txt'), 'created', 'utf8');

    await rollbackManager.recover(vfs, snapshot, testDir);

    expect(await fs.readFile(existingPath, 'utf8')).toBe('original');
    await expect(fs.access(path.join(testDir, 'created.txt'))).rejects.toThrow();
    expect(vfs.read(path.join(testDir, 'existing.txt'))).toBe('modified');
  });
});

describe('TransformEngine rollback recovery', () => {
  const testDir = path.join(__dirname, 'rollback-engine-output');

  beforeAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('reverts disk and vfs state when persistence fails', async () => {
    const existingPath = path.join(testDir, 'stable.txt');
    await fs.writeFile(existingPath, 'stable', 'utf8');

    const failingPersistence = new FailingFilesystemPersistence(existingPath);
    const engine = new TransformEngine(new VirtualFilesystem(), failingPersistence);

    engine.queueOperation({
      type: 'modify',
      filePath: existingPath,
      content: 'updated',
    });
    engine.queueOperation({
      type: 'create',
      filePath: path.join(testDir, 'should-not-exist.txt'),
      content: 'created',
    });

    await expect(engine.execute({ rootDir: testDir })).rejects.toThrow('Simulated persistence failure');

    expect(await fs.readFile(existingPath, 'utf8')).toBe('stable');
    await expect(fs.access(path.join(testDir, 'should-not-exist.txt'))).rejects.toThrow();
    // Recovery only rolls back disk; staged vfs mutations are left in place
    // so the caller can retry execute() after fixing the underlying issue.
    expect(engine.getVirtualFilesystem().read(existingPath)).toBe('updated');
    expect(engine.getVirtualFilesystem().hasStagedChanges()).toBe(true);
  });

  test('commits when persistence succeeds and clears rollback snapshot', async () => {
    const engine = new TransformEngine();
    const targetPath = path.join(testDir, 'success.txt');

    engine.queueTransform(fileCreate('create', targetPath, 'success'));

    await engine.execute({ rootDir: testDir });

    expect(await fs.readFile(targetPath, 'utf8')).toBe('success');
    expect(engine.getVirtualFilesystem().hasStagedChanges()).toBe(false);
  });
});

class FailingFilesystemPersistence implements Pick<FilesystemPersistence, 'persistVirtualFilesystem'> {
  constructor(private readonly failOnPath: string) {}

  async persistVirtualFilesystem(
    vfs: VirtualFilesystem,
    options: { rootDir?: string } = {}
  ): Promise<{ written: string[]; deleted: string[] }> {
    const rootDir = options.rootDir ?? process.cwd();
    const diff = vfs.getDiff();
    const written: string[] = [];

    for (const entry of diff.entries) {
      const targetPath = path.isAbsolute(entry.path)
        ? path.normalize(entry.path)
        : path.join(rootDir, entry.path);

      if (entry.type === 'create' || entry.type === 'modify') {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, entry.after ?? '', 'utf8');
        written.push(targetPath);

        if (targetPath === this.failOnPath || entry.path === this.failOnPath) {
          throw new Error('Simulated persistence failure');
        }
      }
    }

    return { written, deleted: [] };
  }
}
