import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LoggingCapability } from '../src/capability.js';

const capability = new LoggingCapability();

async function project(srcLayout = true): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-capability-logging-'));
  await mkdir(join(root, srcLayout ? 'src/app' : 'app'), { recursive: true });
  return root;
}

const claims = (plan: Awaited<ReturnType<typeof capability.planAdd>>) =>
  plan.ownershipRegistrations.map((r) => `${r.resourceType}:${r.resourceKey}`);

describe('LoggingCapability', () => {
  test('planAdd creates the four files under src/, adds the dependency and env vars, and claims them', async () => {
    const plan = await capability.planAdd(await project(), {});

    expect(plan.transforms.map((t) => t.type)).toEqual([
      'file-create',
      'file-create',
      'file-create',
      'file-create',
      'package-json-mutation',
      'env-mutation',
      'env-mutation',
      'file-create',
    ]);
    expect(claims(plan)).toEqual([
      'file:src/lib/logger.ts',
      'file:src/app/global-error.tsx',
      'file:src/instrumentation.ts',
      'file:src/instrumentation-client.ts',
      'dependency:@sentry/nextjs',
      'envVar:SENTRY_DSN',
      'envVar:NEXT_PUBLIC_SENTRY_DSN',
    ]);
  });

  test('a project without src/ gets the files at the root', async () => {
    const plan = await capability.planAdd(await project(false), {});
    expect(claims(plan)).toContain('file:instrumentation.ts');
    expect(claims(plan)).toContain('file:app/global-error.tsx');
  });

  test('--var values go to .env.local only, never .env.example', async () => {
    const plan = await capability.planAdd(await project(), {
      variables: { SENTRY_DSN: 'https://real-secret@sentry.io/1' },
    });

    const example = plan.transforms.find((t) => t.id === 'logging-env-example');
    const local = plan.transforms.find((t) => t.id === 'logging-env-local');
    expect(JSON.stringify(example)).not.toContain('real-secret');
    expect(JSON.stringify(local)).toContain('real-secret');
  });

  test('a file the user already has is left alone and not claimed', async () => {
    const root = await project();
    await writeFile(join(root, 'src/instrumentation.ts'), '// mine\n');

    const plan = await capability.planAdd(root, {});
    expect(plan.transforms.some((t) => t.id === 'logging-create-instrumentation')).toBe(false);
    expect(claims(plan)).not.toContain('file:src/instrumentation.ts');
  });

  test('a file we already own is kept and still claimed on re-add', async () => {
    const root = await project();
    await mkdir(join(root, 'src/lib'), { recursive: true });
    await writeFile(join(root, 'src/lib/logger.ts'), '// edited by me\n');

    const tracker = {
      getOwner: (type: string, key: string) =>
        type === 'file' && key === 'src/lib/logger.ts' ? 'logging' : undefined,
    };
    const plan = await capability.planAdd(root, { tracker: tracker as never });
    expect(plan.transforms.some((t) => t.id === 'logging-create-logger')).toBe(false);
    expect(claims(plan)).toContain('file:src/lib/logger.ts');
  });

  test('an unknown provider is rejected', async () => {
    await expect(capability.planAdd(await project(), { providers: ['datadog'] })).rejects.toThrow(
      'Unknown logging provider "datadog"'
    );
  });

  test('requires env', async () => {
    expect((await capability.getManifest()).dependencies).toEqual(['env']);
  });
});
