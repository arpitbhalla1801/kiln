import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Capability } from '@kiln-cli/capability-sdk';
import { LockfileStore } from '@kiln-cli/project-model';
import { CapabilityRuntime } from '../src/capability-runtime.js';
import { enhancersOf, registerCapability } from '../src/capability-registry.js';

const tempRoots: string[] = [];

async function createProject(installed: string[] = []): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-graph-'));
  tempRoots.push(root);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo-app', version: '1.0.0' }));
  if (installed.length > 0) {
    await LockfileStore.save(
      {
        lockfileVersion: 1,
        project: { name: 'demo-app', version: '1.0.0' },
        snapshot: {
          capabilities: installed.map((id) => ({
            id,
            version: '1.0.0',
            resolved: `capability:${id}@1.0.0`,
            dependencies: {},
          })),
          timestamp: new Date().toISOString(),
          engineVersion: '0.0.0',
          lastCapability: installed[installed.length - 1],
        },
      },
      root
    );
  }
  return root;
}

function fakeCapability(
  id: string,
  dependencies: string[],
  enhances: string[],
  planned: string[] = []
): Capability {
  const resolved = { id, version: '1.0.0', dependencies, files: [] as string[] };
  return {
    id,
    getManifest: async () => ({ id, version: '1.0.0', dependencies, enhances }),
    getCapability: async () => resolved,
    planAdd: async () => {
      planned.push(id);
      return { transforms: [], capability: resolved, ownershipRegistrations: [] };
    },
  };
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('capability links: requires and enhances', () => {
  test('registry holds enhances for built-ins and enhancersOf inverts it', () => {
    expect(enhancersOf('auth')).toContain('db');
    expect(enhancersOf('db')).toContain('auth');
  });

  test('add stops with an actionable message when a required capability is not installed', async () => {
    registerCapability('gt-teams', ['gt-auth', 'gt-db']);
    const runtime = new CapabilityRuntime({
      capabilities: { 'gt-teams': fakeCapability('gt-teams', ['gt-auth', 'gt-db'], []) },
    });
    const root = await createProject(['gt-auth']);

    await expect(runtime.addCapability('gt-teams', { cwd: root })).rejects.toThrow(
      'add gt-teams requires gt-db. Run kiln add gt-db first.'
    );
  });

  test('plan add reports the missing requirement as a conflict, not a throw', async () => {
    registerCapability('gt-teams2', ['gt-auth', 'gt-db']);
    const runtime = new CapabilityRuntime({
      capabilities: { 'gt-teams2': fakeCapability('gt-teams2', ['gt-auth', 'gt-db'], []) },
    });
    const root = await createProject();

    const result = await runtime.planCapability('gt-teams2', { cwd: root });

    expect(result.conflicts).toEqual([
      'add gt-teams2 requires gt-auth, gt-db. Run kiln add gt-auth and kiln add gt-db first.',
    ]);
    expect(result.preview).toBeUndefined();
  });

  test('auth and db still add on a project with no env installed', async () => {
    const runtime = new CapabilityRuntime();
    const root = await createProject();

    const result = await runtime.addCapability('auth', { cwd: root, dryRun: true });

    expect(result.capabilityId).toBe('auth');
  });

  test('adding a capability re-plans installed capabilities that enhance it', async () => {
    registerCapability('gt-base', []);
    registerCapability('gt-invites', [], ['gt-base']);
    const planned: string[] = [];
    const runtime = new CapabilityRuntime({
      capabilities: {
        'gt-base': fakeCapability('gt-base', [], [], planned),
        'gt-invites': fakeCapability('gt-invites', [], ['gt-base'], planned),
      },
    });
    const root = await createProject(['gt-invites']);

    await runtime.addCapability('gt-base', { cwd: root });

    expect(planned).toEqual(['gt-base', 'gt-invites']);
  });

  test('does not re-plan an enhancer that is not installed', async () => {
    registerCapability('gt-base2', []);
    registerCapability('gt-invites2', [], ['gt-base2']);
    const planned: string[] = [];
    const runtime = new CapabilityRuntime({
      capabilities: {
        'gt-base2': fakeCapability('gt-base2', [], [], planned),
        'gt-invites2': fakeCapability('gt-invites2', [], ['gt-base2'], planned),
      },
    });
    const root = await createProject();

    await runtime.addCapability('gt-base2', { cwd: root });

    expect(planned).toEqual(['gt-base2']);
  });
});
