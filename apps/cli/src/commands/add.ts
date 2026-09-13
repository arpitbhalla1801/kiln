import { createCapabilityRuntime, SUPPORTED_CAPABILITY_IDS } from '@kiln/runtime';
import type { EnvVariableMap } from '@kiln/env-capability';
import type { SupportedCapabilityId } from '@kiln/runtime';
import { formatCapabilityResult } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

const DEFAULT_ENV_VARS: EnvVariableMap = {
  DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
};

export async function runAdd(
  capabilityId: string,
  options: CliOptions,
  envVariables: EnvVariableMap = {},
  providers: string[] = []
): Promise<void> {
  if (!SUPPORTED_CAPABILITY_IDS.includes(capabilityId)) {
    throw new Error(
      `Unsupported capability '${capabilityId}'. Supported capabilities: ${SUPPORTED_CAPABILITY_IDS.join(', ')}`
    );
  }

  const rootPath = await resolveProjectRoot(options.cwd);
  const runtime = createCapabilityRuntime();
  const capability = capabilityId as SupportedCapabilityId;

  const variables =
    capability === 'env' && Object.keys(envVariables).length === 0
      ? DEFAULT_ENV_VARS
      : envVariables;

  const result =
    capability === 'env'
      ? await runtime.addEnv(variables, { cwd: rootPath, dryRun: options.dryRun })
      : await runtime.addAuth({
          cwd: rootPath,
          dryRun: options.dryRun,
          providers,
          extraEnvVars: envVariables,
        });

  console.log(
    formatCapabilityResult(
      result.capabilityId,
      result.dryRun,
      result.preview,
      result.resolvedDependencies
    )
  );
}

export function parseEnvVariables(argv: string[]): EnvVariableMap {
  const variables: EnvVariableMap = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--var' && argv[index + 1]) {
      const pair = argv[index + 1];
      const separator = pair.indexOf('=');
      if (separator === -1) {
        throw new Error(`Invalid --var format '${pair}'. Use --var KEY=value`);
      }

      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      assertSingleLine(key, value);
      variables[key] = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--var=')) {
      const pair = arg.slice('--var='.length);
      const separator = pair.indexOf('=');
      if (separator === -1) {
        throw new Error(`Invalid --var format '${arg}'. Use --var=KEY=value`);
      }

      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      assertSingleLine(key, value);
      variables[key] = value;
    }
  }

  return variables;
}

export function parseProviders(argv: string[]): string[] {
  const providers: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--provider' && argv[index + 1]) {
      providers.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--provider=')) {
      providers.push(arg.slice('--provider='.length));
    }
  }

  return providers;
}

function assertSingleLine(key: string, value: string): void {
  if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) {
    throw new Error(
      `Invalid --var value for '${key}': env var keys and values cannot contain newlines.`
    );
  }
}
