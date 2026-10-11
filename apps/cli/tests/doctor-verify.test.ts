import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAdd } from '../src/commands/add.js';
import { runDoctor, type VerifyExecutor } from '../src/commands/doctor.js';
import { runInit } from '../src/commands/init.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function projectWithAuth(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-doctor-verify-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  await runAdd('auth', { cwd: root, dryRun: false });
  return root;
}

async function quiet<T>(run: () => Promise<T>): Promise<{ result?: T; error?: Error; logs: string[] }> {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    return { result: await run(), logs };
  } catch (error) {
    return { error: error as Error, logs };
  } finally {
    console.log = original;
  }
}

describe('kiln doctor --verify', () => {
  test('runs verify commands of installed capabilities only', async () => {
    const cwd = await projectWithAuth();
    const commands: string[] = [];
    const execute: VerifyExecutor = (command) => {
      commands.push(command);
      return { ok: true, output: '' };
    };

    const { logs } = await quiet(() => runDoctor({ cwd, dryRun: false, verify: true }, execute));

    // auth is installed and declares one; db is not installed, env declares none.
    expect(commands).toEqual(['npx tsc --noEmit']);
    expect(logs.join('\n')).toContain('[pass] auth: npx tsc --noEmit');
  }, 60000);

  test('a failing verify command fails doctor and shows its output', async () => {
    const cwd = await projectWithAuth();
    const execute: VerifyExecutor = () => ({ ok: false, output: 'error TS2307: cannot find module' });

    const { error, logs } = await quiet(() => runDoctor({ cwd, dryRun: false, verify: true }, execute));

    expect(error?.message).toMatch(/failing check/);
    expect(logs.join('\n')).toContain('[fail] auth: npx tsc --noEmit');
    expect(logs.join('\n')).toContain('error TS2307');
  }, 60000);

  test('does not run anything without --verify', async () => {
    const cwd = await projectWithAuth();
    let called = false;
    const execute: VerifyExecutor = () => {
      called = true;
      return { ok: true, output: '' };
    };

    await quiet(() => runDoctor({ cwd, dryRun: false }, execute));

    expect(called).toBe(false);
  }, 60000);
});
