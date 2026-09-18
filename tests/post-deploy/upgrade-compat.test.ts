import { describe, expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { exampleAppRoot, runCommand, runKiln } from './cli-runner.js';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('post-deploy upgrade compatibility', () => {
  test('PD-20 example inspect still detects Next.js and ownership', () => {
    const result = runKiln(['inspect'], exampleAppRoot);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('name: kiln-nextjs-example');
    expect(result.stdout).toContain('nextjs: yes');
    expect(result.stdout).toContain('file .env.example -> env');
    expect(result.stdout).toContain('file src/auth.ts -> auth');
    expect(result.stdout).toContain('dependency next-auth -> auth');
  });

  test('PD-21 example doctor does not fail', () => {
    const result = runKiln(['doctor'], exampleAppRoot);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('[pass] package-json-health: valid');
    expect(result.stdout).not.toContain('[fail]');
  });

  test('PD-22 example app still production-builds', () => {
    const result = runCommand('bun', ['run', 'build'], exampleAppRoot);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Compiled successfully');
  }, 120000);

  test('PD-23 re-applying auth on example is idempotent', async () => {
    const packageJsonPath = join(exampleAppRoot, 'package.json');
    const envPath = join(exampleAppRoot, '.env.example');
    const ownershipPath = join(exampleAppRoot, '.kiln/ownership.json');
    const envLocalPath = join(exampleAppRoot, '.env.local');

    // .env.local is gitignored, so a fresh checkout never has it and the
    // first `add auth` here would always create it. Prime it first so this
    // test measures re-apply idempotency, not first-apply.
    const envLocalExistedBefore = await fileExists(envLocalPath);
    if (!envLocalExistedBefore) {
      const primeResult = runKiln(['add', 'auth'], exampleAppRoot);
      expect(primeResult.exitCode).toBe(0);
    }

    const beforePackageJson = await readFile(packageJsonPath, 'utf8');
    const beforeEnv = await readFile(envPath, 'utf8');
    const beforeOwnership = await readFile(ownershipPath, 'utf8');

    try {
      const result = runKiln(['add', 'auth'], exampleAppRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('no changes');
      expect(await readFile(packageJsonPath, 'utf8')).toBe(beforePackageJson);
      expect(await readFile(envPath, 'utf8')).toBe(beforeEnv);
      expect(await readFile(ownershipPath, 'utf8')).toBe(beforeOwnership);
    } finally {
      const { writeFile, rm } = await import('node:fs/promises');
      await writeFile(packageJsonPath, beforePackageJson);
      await writeFile(envPath, beforeEnv);
      await writeFile(ownershipPath, beforeOwnership);
      if (!envLocalExistedBefore) {
        await rm(envLocalPath, { force: true });
      }
    }
  });
});
