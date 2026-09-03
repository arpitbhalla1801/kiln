import { describe, expect, test } from 'bun:test';
import { VirtualFilesystem } from '../src/vfs.js';

describe('VirtualFilesystem', () => {
  test('reads baseline files from initial snapshot', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'src/index.ts': 'export {}',
        'package.json': '{}',
      },
    });

    expect(vfs.read('src/index.ts')).toBe('export {}');
    expect(vfs.exists('package.json')).toBe(true);
    expect(vfs.list()).toEqual(['package.json', 'src/index.ts']);
  });

  test('stages create, update, and delete mutations in memory', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'existing.ts': 'before',
      },
    });

    vfs.write('new.ts', 'created');
    vfs.update('existing.ts', 'after');
    vfs.delete('existing.ts');

    expect(vfs.read('new.ts')).toBe('created');
    expect(vfs.read('existing.ts')).toBeUndefined();
    expect(vfs.hasStagedChanges()).toBe(true);
    expect(vfs.getStagedMutationCount()).toBe(2);
  });

  test('update throws when file does not exist', () => {
    const vfs = new VirtualFilesystem();

    expect(() => vfs.update('missing.ts', 'content')).toThrow(
      'Cannot update missing file: missing.ts'
    );
  });

  test('tracks diffs for staged mutations', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'a.ts': 'a',
        'b.ts': 'b',
      },
    });

    vfs.write('c.ts', 'c');
    vfs.update('a.ts', 'a-updated');
    vfs.delete('b.ts');

    const diff = vfs.getDiff();

    expect(diff.summary).toEqual({
      created: 1,
      modified: 1,
      deleted: 1,
      total: 3,
    });

    expect(diff.entries).toEqual([
      { path: 'a.ts', type: 'modify', before: 'a', after: 'a-updated' },
      { path: 'b.ts', type: 'delete', before: 'b' },
      { path: 'c.ts', type: 'create', after: 'c' },
    ]);
  });

  test('reset discards staged mutations without changing baseline', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'keep.ts': 'keep',
      },
    });

    vfs.write('keep.ts', 'changed');
    vfs.reset();

    expect(vfs.read('keep.ts')).toBe('keep');
    expect(vfs.hasStagedChanges()).toBe(false);
  });

  test('commit applies staged mutations to baseline', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'old.ts': 'old',
      },
    });

    vfs.write('new.ts', 'new');
    vfs.delete('old.ts');
    vfs.commit();

    expect(vfs.snapshot()).toEqual({ files: { 'new.ts': 'new' } });
    expect(vfs.hasStagedChanges()).toBe(false);
  });

  test('snapshot returns merged deterministic file tree', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'b.ts': 'b',
      },
    });

    vfs.write('a.ts', 'a');
    vfs.delete('b.ts');

    expect(vfs.snapshot()).toEqual({ files: { 'a.ts': 'a' } });
  });

  test('normalizes windows-style paths', () => {
    const vfs = new VirtualFilesystem();
    vfs.write('src\\nested\\file.ts', 'content');

    expect(vfs.read('src/nested/file.ts')).toBe('content');
    expect(vfs.list('src/nested')).toEqual(['src/nested/file.ts']);
  });
});
