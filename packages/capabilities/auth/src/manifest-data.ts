/**
 * Embedded mirror of ../kiln.manifest.json.
 *
 * Loaded as a plain object instead of read from disk at runtime so the
 * capability works when bundled into a single-file CLI (no import.meta.url
 * or __dirname-based path resolution, and no need to ship the .json file
 * alongside the bundle). Keep in sync with kiln.manifest.json.
 */
import { AUTH_PROVIDERS } from './providers.js';

export const AUTH_MANIFEST = {
  id: 'auth',
  name: 'Authentication',
  version: '1.0.0',
  description:
    'Adds Auth.js (next-auth) sign-in with selectable providers, middleware, and a route handler; uses the Prisma adapter when db is present.',
  frameworks: ['nextjs'],
  // One source of truth: the same table `--provider` is resolved against.
  providers: Object.values(AUTH_PROVIDERS).map(({ id, description }) => ({ id, description })),
  config: [
    {
      name: '--provider',
      description: 'Provider id to enable; repeat for several. Omit to leave providers unchanged.',
      required: false,
    },
    {
      name: '--var',
      description: 'KEY=value written to .env.local, e.g. AUTH_GITHUB_ID=....',
      required: false,
    },
  ],
  operations: ['add', 'remove'],
  verify: [
    {
      command: 'npx tsc --noEmit',
      description: 'Type-check the generated auth.ts, middleware and route handler.',
    },
  ],
  dependencies: ['env'],
  enhances: ['db'],
  adapters: ['node-adapter'],
  ownership: {
    files: [],
    dependencies: ['next-auth'],
  },
};
