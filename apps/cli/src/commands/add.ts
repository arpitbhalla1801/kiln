import { detectNextJs } from '@kiln/node-adapter';
import { createCapabilityRuntime, SUPPORTED_CAPABILITY_IDS } from '@kiln/runtime';
import type { EnvVariableMap } from '@kiln/env-capability';
import { formatCapabilityResult } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

const TYPESCRIPT_CAPABILITIES = ['auth', 'db'];

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

  if (TYPESCRIPT_CAPABILITIES.includes(capabilityId) && !(await detectNextJs(rootPath)).typescript) {
    throw new Error(
      `Refusing to add ${capabilityId}: it writes TypeScript files, but this project has no TypeScript setup ` +
        '(no tsconfig.json and no typescript dependency). Add TypeScript first, then run this again.'
    );
  }

  const runtime = createCapabilityRuntime();

  const variables =
    capabilityId === 'env' && Object.keys(envVariables).length === 0
      ? DEFAULT_ENV_VARS
      : envVariables;

  const result = await runtime.addCapability(capabilityId, {
    cwd: rootPath,
    dryRun: options.dryRun,
    variables,
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

function parseFlagValues(argv: string[], flagName: string): string[] {
  const values: string[] = [];
  const flag = `--${flagName}`;
  const flagWithEquals = `${flag}=`;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith(flagWithEquals)) {
      values.push(arg.slice(flagWithEquals.length));
    }
  }

  return values;
}

export function parseEnvVariables(argv: string[]): EnvVariableMap {
  const variables: EnvVariableMap = {};

  for (const pair of parseFlagValues(argv, 'var')) {
    const separator = pair.indexOf('=');
    if (separator === -1) {
      throw new Error(`Invalid --var format '${pair}'. Use --var KEY=value`);
    }

    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    assertSingleLine(key, value);
    variables[key] = value;
  }

  return variables;
}

export function parseProviders(argv: string[]): string[] {
  return parseFlagValues(argv, 'provider');
}

function assertSingleLine(key: string, value: string): void {
  if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) {
    throw new Error(
      `Invalid --var value for '${key}': env var keys and values cannot contain newlines.`
    );
  }
}
