export function createLoggerModule(): string {
  return `import * as Sentry from '@sentry/nextjs';

// The only file that imports the logging provider. To switch providers, rewrite
// this module; callers keep using captureException and captureMessage.
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  Sentry.captureMessage(message, level);
}
`;
}

export function createGlobalError(): string {
  return `'use client';

import NextError from 'next/error';
import { useEffect } from 'react';
import { captureException } from '../lib/logger';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
`;
}

export function createInstrumentation(): string {
  return `import * as Sentry from '@sentry/nextjs';

export function register(): void {
  Sentry.init({ dsn: process.env.SENTRY_DSN, enabled: Boolean(process.env.SENTRY_DSN) });
}

export const onRequestError = Sentry.captureRequestError;
`;
}

export function createInstrumentationClient(): string {
  return `import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
`;
}
