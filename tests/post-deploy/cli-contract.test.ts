import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, runKiln } from './cli-runner.js';

describe('post-deploy CLI contract', () => {
  test('PD-01 help lists create, add, inspect, doctor', () => {
    const result = runKiln(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('create');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('inspect');
    expect(result.stdout).toContain('doctor');
  });

  test('PD-02 version prints package version', () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, 'apps/cli/package.json'), 'utf8').replace(/^\uFEFF/, '')
    ) as {
      version: string;
    };
    const result = runKiln(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  test('PD-03 unknown command exits non-zero', () => {
    const result = runKiln(['not-a-command']);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('Unknown command');
  });

  test('PD-04 add without capability exits non-zero', () => {
    const result = runKiln(['add']);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('Missing capability');
  });

  test('PD-05 add unsupported capability exits non-zero', () => {
    const result = runKiln(['add', 'payments']);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("Unsupported capability 'payments'");
  });

  test('PD-06 inspect outside a project exits non-zero', () => {
    const result = runKiln(['inspect'], '/tmp');
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('No kiln project found');
  });
});
