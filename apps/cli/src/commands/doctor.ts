import { spawnSync } from 'node:child_process';
import { createCapabilityRuntime } from '@kiln-cli/runtime';
import { collectChecks } from '../health.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';
import { readInstalled } from './capabilities.js';

const VERIFY_TIMEOUT_MS = 120_000;

export interface VerifyOutcome {
  ok: boolean;
  /** Last lines of combined output, for the failure report. */
  output: string;
}

/** Runs one verify command through the shell in the project root. */
export type VerifyExecutor = (command: string, cwd: string) => VerifyOutcome;

const shellExecutor: VerifyExecutor = (command, cwd) => {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout: VERIFY_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  return { ok: result.status === 0 && !result.error, output: output.trim().split('\n').slice(-8).join('\n') };
};

export async function runDoctor(
  options: CliOptions,
  execute: VerifyExecutor = shellExecutor
): Promise<void> {
  const checks = await collectChecks(options);

  console.log('Kiln doctor');
  let failures = 0;

  for (const check of checks) {
    console.log(`  [${check.status}] ${check.name}: ${check.detail}`);
    if (check.status === 'fail') {
      failures += 1;
    }
  }

  if (options.verify) {
    failures += await runVerifySteps(options, execute);
  }

  if (failures > 0) {
    throw new Error(`Doctor found ${failures} failing check(s)`);
  }
}

/**
 * Runs the `verify` commands of every installed capability. Only capabilities
 * kiln actually loaded are considered, so an unverified plugin's commands run
 * only when the user enabled it with --allow-unverified.
 */
async function runVerifySteps(options: CliOptions, execute: VerifyExecutor): Promise<number> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const runtime = createCapabilityRuntime({ allowUnverified: options.allowUnverified });
  await runtime.loadPlugins(rootPath);
  const installed = await readInstalled(rootPath);
  const capabilities = (await runtime.describeCapabilities())
    .filter((entry) => installed.has(entry.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log('Capability verify');
  let failures = 0;
  let ran = 0;

  for (const entry of capabilities) {
    for (const step of entry.manifest.verify) {
      ran += 1;
      const outcome = execute(step.command, rootPath);
      const trust = entry.verified ? '' : ' (unverified plugin)';
      console.log(`  [${outcome.ok ? 'pass' : 'fail'}] ${entry.id}${trust}: ${step.command} -- ${step.description}`);
      if (!outcome.ok) {
        failures += 1;
        for (const line of outcome.output.split('\n').filter(Boolean)) {
          console.log(`      ${line}`);
        }
      }
    }
  }

  if (ran === 0) {
    console.log('  no installed capability declares a verify command');
  }

  return failures;
}
