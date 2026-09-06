import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TransformEngine } from '../src/engine.js';
import { packageJsonMutation } from '../src/transform-builders.js';

describe('disk seeding', () => {
  test('merges package.json mutations against existing on-disk content', async () => {
    const rootDir = path.join(__dirname, 'disk-seed-output');
    await fs.rm(rootDir, { recursive: true, force: true });
    await fs.mkdir(rootDir, { recursive: true });

    await fs.writeFile(
      path.join(rootDir, 'package.json'),
      JSON.stringify(
        {
          name: 'demo-app',
          scripts: { build: 'next build' },
          dependencies: { next: '^15.0.0' },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const engine = new TransformEngine();
    const transforms = [
      packageJsonMutation('add-next-auth', {
        dependencies: { 'next-auth': '^5.0.0-beta.32' },
      }),
    ];

    await engine.queueTransformsFromDisk(rootDir, transforms);
    await engine.execute({ rootDir });

    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('demo-app');
    expect(packageJson.scripts).toEqual({ build: 'next build' });
    expect(packageJson.dependencies).toEqual({
      next: '^15.0.0',
      'next-auth': '^5.0.0-beta.32',
    });

    await fs.rm(rootDir, { recursive: true, force: true });
  });
});
