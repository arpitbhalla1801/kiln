import { collectChecks } from '../health.js';
import type { CliOptions } from '../output.js';

export async function runDoctor(options: CliOptions): Promise<void> {
  const checks = await collectChecks(options);

  console.log('Kiln doctor');
  let failures = 0;

  for (const check of checks) {
    console.log(`  [${check.status}] ${check.name}: ${check.detail}`);
    if (check.status === 'fail') {
      failures += 1;
    }
  }

  if (failures > 0) {
    throw new Error(`Doctor found ${failures} failing check(s)`);
  }
}
