import type { CapabilityPlan, CapabilityPlanOptions } from '@kiln-cli/capability-sdk';

export const LOGGING_CAPABILITY_ID = 'logging';
export const DEFAULT_PROVIDER = 'sentry';

export const SENTRY_DSN = 'SENTRY_DSN';
export const SENTRY_PUBLIC_DSN = 'NEXT_PUBLIC_SENTRY_DSN';
export const LOGGING_ENV_VARS = [SENTRY_DSN, SENTRY_PUBLIC_DSN];

export const LOGGING_DEPENDENCIES: Record<string, string> = { '@sentry/nextjs': '^11.8.0' };

/** Files this capability writes, relative to the source root (`src/` or the project root). */
export const LOGGING_FILES = {
  logger: 'lib/logger.ts',
  globalError: 'app/global-error.tsx',
  instrumentation: 'instrumentation.ts',
  instrumentationClient: 'instrumentation-client.ts',
} as const;

export interface LoggingCapabilityPlanOptions extends CapabilityPlanOptions {
  /** Values from `kiln add logging --var KEY=VALUE`. */
  variables?: Record<string, string>;
  /** Values from `--provider`. Only `sentry` exists today. */
  providers?: string[];
}

export type LoggingCapabilityPlan = CapabilityPlan;
