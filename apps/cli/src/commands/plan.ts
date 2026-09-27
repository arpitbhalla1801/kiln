import { createCapabilityRuntime } from '@kiln/runtime';
import type { EnvVariableMap } from '@kiln/env-capability';
import { assertCapabilityPrerequisites, resolveEnvVariables } from './add.js';
import { formatResolvedDependencies, formatTransformPlan } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

export async function runPlanAdd(
  capabilityId: string,
  options: CliOptions,
  envVariables: EnvVariableMap = {},
  providers: string[] = []
): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const runtime = createCapabilityRuntime();
  await runtime.loadPlugins(rootPath);
  await assertCapabilityPrerequisites(capabilityId, rootPath);

  const variables = resolveEnvVariables(capabilityId, envVariables);

  const result = await runtime.planCapability(capabilityId, {
    cwd: rootPath,
    variables,
    providers,
    extraEnvVars: envVariables,
  });

  console.log(`Capability: ${result.capabilityId}`);
  console.log('Mode: plan');

  if (result.conflicts.length > 0) {
    console.log('Conflicts detected:');
    for (const conflict of result.conflicts) {
      console.log(`  ${conflict}`);
    }
    return;
  }

  console.log(formatTransformPlan(result.preview!, true));
  console.log(formatResolvedDependencies(result.resolvedDependencies));

  console.log('Ownership updates:');
  if (result.ownershipUpdates.length === 0) {
    console.log('  none');
  } else {
    for (const update of result.ownershipUpdates) {
      console.log(`  ${update}`);
    }
  }
}
