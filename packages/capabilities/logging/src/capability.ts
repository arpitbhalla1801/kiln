import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Capability,
  CapabilityManifest,
  ResolvedCapability,
  TypedTransform,
} from '@kiln-cli/capability-sdk';
import { LOGGING_MANIFEST } from './manifest-data.js';
import {
  createGlobalError,
  createInstrumentation,
  createInstrumentationClient,
  createLoggerModule,
} from './templates.js';
import {
  DEFAULT_PROVIDER,
  LOGGING_CAPABILITY_ID,
  LOGGING_DEPENDENCIES,
  LOGGING_FILES,
  SENTRY_DSN,
  SENTRY_PUBLIC_DSN,
  type LoggingCapabilityPlan,
  type LoggingCapabilityPlanOptions,
} from './types.js';
import { buildLoggingOwnershipRegistrations } from './validation.js';

export class LoggingCapability implements Capability {
  readonly id = LOGGING_CAPABILITY_ID;

  async getManifest(): Promise<CapabilityManifest> {
    return LOGGING_MANIFEST;
  }

  async getCapability(): Promise<ResolvedCapability> {
    const { id, name, version, dependencies, ownership } = await this.getManifest();
    return {
      id,
      name,
      version,
      dependencies: [...dependencies],
      files: ownership?.files,
      ownedDependencies: ownership?.dependencies,
      ownedEnvVars: ownership?.envVars,
    };
  }

  async planAdd(
    rootPath: string,
    options: LoggingCapabilityPlanOptions
  ): Promise<LoggingCapabilityPlan> {
    const id = LOGGING_CAPABILITY_ID;
    for (const provider of options.providers ?? []) {
      if (provider !== DEFAULT_PROVIDER) {
        throw new Error(`Unknown logging provider "${provider}". Available: ${DEFAULT_PROVIDER}`);
      }
    }

    const prefix = existsSync(join(rootPath, 'src', 'app')) ? 'src/' : '';
    const contents: Record<keyof typeof LOGGING_FILES, string> = {
      logger: createLoggerModule(),
      globalError: createGlobalError(),
      instrumentation: createInstrumentation(),
      instrumentationClient: createInstrumentationClient(),
    };

    const transforms: TypedTransform[] = [];
    const claimed: string[] = [];
    for (const [key, relative] of Object.entries(LOGGING_FILES)) {
      const filePath = `${prefix}${relative}`;
      if (existsSync(join(rootPath, filePath))) {
        // Re-add keeps our file as is. A file kiln did not write is the user's:
        // leave it alone and do not claim it, so remove never deletes it.
        if (options.tracker?.getOwner('file', filePath) === id) claimed.push(filePath);
        continue;
      }
      claimed.push(filePath);
      transforms.push({
        id: `${id}-create-${key}`,
        type: 'file-create',
        filePath,
        content: contents[key as keyof typeof LOGGING_FILES],
      });
    }

    transforms.push(
      {
        id: `${id}-package-json`,
        type: 'package-json-mutation',
        dependencies: LOGGING_DEPENDENCIES,
      },
      // .env.example is committed: placeholder only, never a real value.
      {
        id: `${id}-env-example`,
        type: 'env-mutation',
        filePath: options.envExamplePath ?? '.env.example',
        variables: {
          [SENTRY_DSN]: { example: 'replace-me', required: false },
          [SENTRY_PUBLIC_DSN]: { example: 'replace-me', required: false },
        },
        section: id,
        preserveExistingValues: true,
      },
      // .env.local is gitignored: gets the values from `--var SENTRY_DSN=...`, if given.
      {
        id: `${id}-env-local`,
        type: 'env-mutation',
        filePath: '.env.local',
        variables: {
          [SENTRY_DSN]: options.variables?.[SENTRY_DSN] ?? '',
          [SENTRY_PUBLIC_DSN]: options.variables?.[SENTRY_PUBLIC_DSN] ?? '',
        },
        preserveExistingValues: true,
      }
    );

    const gitignore = await readFile(join(rootPath, '.gitignore'), 'utf8').catch(() => '');
    if (!gitignore.split(/\r?\n/).some((line) => line.trim() === '.env.local')) {
      const separator = gitignore && !gitignore.endsWith('\n') ? '\n' : '';
      transforms.push({
        id: `${id}-gitignore-env-local`,
        type: 'file-create',
        filePath: '.gitignore',
        content: `${gitignore}${separator}.env.local\n`,
      });
    }

    return {
      transforms,
      capability: await this.getCapability(),
      ownershipRegistrations: buildLoggingOwnershipRegistrations(claimed),
    };
  }
}

