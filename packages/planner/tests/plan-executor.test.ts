import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OwnershipTracker } from '@kiln/core';
import { TransformEngine, VirtualFilesystem } from '@kiln/transform-engine';
import { AuthCapability } from '@kiln/auth-capability';
import { createPlanExecutor } from '../src/plan-executor.js';

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plan-executor-'));
  tempRoots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('PlanExecutor', () => {
  test('executes auth capability plan and registers ownership', async () => {
    const root = await createTempProject();
    const auth = new AuthCapability();
    const authPlan = await auth.planAdd(root, {
      nextAuthInstalled: false,
      authFileExists: false,
      middlewareFileExists: false,
      envExampleExists: false,
    });

    const engine = new TransformEngine(
      new VirtualFilesystem({
        initialFiles: { 'package.json': JSON.stringify({ name: 'demo', version: '1.0.0' }) },
      })
    );
    const tracker = new OwnershipTracker();
    const executor = createPlanExecutor(engine, tracker);

    executor.queueCapabilityPlan({
      transforms: authPlan.transforms,
      capability: authPlan.capability,
      ownershipRegistrations: authPlan.ownershipRegistrations,
    });

    const result = executor.finalize();

    expect(result.resolvedDependencies.get('next-auth')).toBe('^5.0.0-beta.32');
    expect(tracker.getOwner('dependency', 'next-auth')).toBe('auth');
    expect(tracker.getOwner('envVar', 'AUTH_SECRET')).toBe('env');
    expect(engine.getVirtualFilesystem().read('auth.ts')).toContain('NextAuth');
    expect(engine.getVirtualFilesystem().read('.env.example')).toContain('AUTH_SECRET');
  });
});
