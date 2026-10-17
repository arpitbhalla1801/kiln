import './helpers/no-install.js';
import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { runRemove } from '../src/commands/remove.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

const exists = (path: string) => access(path).then(() => true, () => false);

describe('kiln add logging', () => {
  test('refuses until env is installed, then adds and removes cleanly', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-logging-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');

    await expect(runAdd('logging', { cwd: root })).rejects.toThrow(/env/);

    await runAdd('env', { cwd: root });
    await runAdd('logging', { cwd: root }, { SENTRY_DSN: 'https://secret@sentry.io/1' }, ['sentry']);

    const example = await readFile(join(root, '.env.example'), 'utf8');
    expect(example).toContain('SENTRY_DSN=replace-me');
    expect(example).not.toContain('secret@');
    expect(await readFile(join(root, '.env.local'), 'utf8')).toContain('secret@sentry.io');

    const loggerPath = [join(root, 'lib/logger.ts'), join(root, 'src/lib/logger.ts')];
    expect((await Promise.all(loggerPath.map(exists))).some(Boolean)).toBe(true);

    await runRemove('logging', { cwd: root });
    expect((await Promise.all(loggerPath.map(exists))).some(Boolean)).toBe(false);
    expect(await readFile(join(root, '.env.example'), 'utf8')).not.toContain('SENTRY_DSN');
  }, 120000);

  test('rejects a provider the manifest does not declare', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-logging-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root });

    await expect(runAdd('logging', { cwd: root }, {}, ['datadog'])).rejects.toThrow(
      "Unknown logging provider 'datadog'. Valid providers: sentry"
    );
  }, 120000);
});
