import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { runInspect } from '../src/commands/inspect.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function inspectOutput(root: string, verbose = false): Promise<string> {
  const lines: string[] = [];
  const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  try {
    await runInspect({ cwd: root, dryRun: false, verbose });
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

describe('kiln inspect', () => {
  test('summarises capabilities, managed files, dependencies and last operation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });
    await runAdd('auth', { cwd: root, dryRun: false });

    const output = await inspectOutput(root);

    expect(output).toContain('Project: Next.js +');
    expect(output).toContain('✓ env');
    expect(output).toContain('✓ auth');
    expect(output).toContain('✗ db');
    expect(output).toMatch(/Managed files: [1-9]\d*/);
    expect(output).toContain('Dependencies added: next-auth');
    expect(output).toContain('Last operation: auth@');
    expect(output).toContain('Status:');
    expect(output).not.toContain('Ownership:');
  }, 60000);

  test('--verbose also lists every owned item', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    const output = await inspectOutput(root, true);

    expect(output).toContain('Ownership:');
    expect(output).toContain('file .env.example -> env');
  }, 60000);

  test('fresh project shows no capabilities and no last operation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');

    const output = await inspectOutput(root);

    expect(output).toContain('✗ env');
    expect(output).toContain('Last operation: none');
  }, 60000);
});
