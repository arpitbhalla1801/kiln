import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  OwnershipMetadataStore,
  getOwnershipMetadataPath,
  KILN_DIRECTORY,
  OWNERSHIP_METADATA_FILE,
} from '../src/ownership-storage.js';
import { loadOwnershipTracker, saveOwnershipTracker } from '../src/ownership-bridge.js';
import { OwnershipTracker } from '@kiln/core';
import type { OwnershipMetadata } from '../src/types.js';

describe('OwnershipMetadataStore', () => {
  const projectRoot = path.join(__dirname, 'ownership-storage-output');

  beforeAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  test('writes ownership metadata to .kiln/ownership.json', async () => {
    const metadata: OwnershipMetadata = {
      files: [{ filePath: 'middleware.ts', ownerCapabilityId: 'auth' }],
      dependencies: [{ name: 'next-auth', ownerCapabilityId: 'auth' }],
      scripts: [{ name: 'dev', ownerCapabilityId: 'core' }],
      envVars: [{ name: 'AUTH_SECRET', ownerCapabilityId: 'env' }],
      metadata: [{ key: 'next.config.ts', ownerCapabilityId: 'core' }],
    };

    await OwnershipMetadataStore.save(metadata, projectRoot);

    const ownershipPath = getOwnershipMetadataPath(projectRoot);
    expect(ownershipPath).toBe(path.join(projectRoot, KILN_DIRECTORY, OWNERSHIP_METADATA_FILE));
    expect(await OwnershipMetadataStore.exists(projectRoot)).toBe(true);

    const content = await fs.readFile(ownershipPath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.ownership.files[0].filePath).toBe('middleware.ts');
    expect(parsed.ownership.metadata[0].key).toBe('next.config.ts');
  });

  test('loads ownership metadata from disk', async () => {
    const metadata: OwnershipMetadata = {
      files: [{ filePath: 'src/auth.ts', ownerCapabilityId: 'auth' }],
      dependencies: [{ name: 'zod', ownerCapabilityId: 'auth' }],
      scripts: [],
      envVars: [],
      metadata: [],
    };

    await OwnershipMetadataStore.save(metadata, projectRoot);
    const loaded = await OwnershipMetadataStore.load(projectRoot);

    expect(loaded).toEqual(metadata);
  });

  test('ownership survives load through OwnershipTracker', async () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('middleware.ts', 'auth');
    tracker.registerDependency('next-auth', 'auth');
    tracker.registerScript('dev', 'core');
    tracker.registerEnvVar('AUTH_SECRET', 'env');
    tracker.registerMetadata('next.config.ts', 'core');

    await saveOwnershipTracker(tracker, projectRoot);

    const loadedTracker = await loadOwnershipTracker(projectRoot);

    expect(loadedTracker.toSnapshot()).toEqual(tracker.toSnapshot());
    expect(loadedTracker.getOwner('dependency', 'next-auth')).toBe('auth');
    expect(loadedTracker.getOwner('metadata', 'next.config.ts')).toBe('core');
  });

  test('loadOwnershipTracker reads persisted ownership state', async () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('routes.ts', 'auth');
    await saveOwnershipTracker(tracker, projectRoot);

    const loadedTracker = await loadOwnershipTracker(projectRoot);
    expect(loadedTracker.getOwner('file', 'routes.ts')).toBe('auth');
  });

  test('leaves no temp files after save', async () => {
    await OwnershipMetadataStore.save(
      {
        files: [],
        dependencies: [],
        scripts: [],
        envVars: [],
        metadata: [],
      },
      projectRoot
    );

    const kilnDir = path.join(projectRoot, KILN_DIRECTORY);
    const entries = await fs.readdir(kilnDir);
    expect(entries.some((entry) => entry.includes('.kiln.tmp'))).toBe(false);
  });
});
