/**
 * Embedded mirror of ../kiln.manifest.json.
 *
 * Loaded as a plain object instead of read from disk at runtime so the
 * capability works when bundled into a single-file CLI (no import.meta.url
 * or __dirname-based path resolution, and no need to ship the .json file
 * alongside the bundle). Keep in sync with kiln.manifest.json.
 */
export const DB_MANIFEST = {
  id: 'db',
  name: 'Database (Prisma)',
  version: '1.0.0',
  description:
    'Adds Prisma with a client singleton, schema, DATABASE_URL, and db:generate, db:migrate and db:studio scripts.',
  frameworks: ['nextjs'],
  providers: [],
  config: [],
  operations: ['add', 'remove'],
  verify: [{ command: 'npx prisma validate', description: 'Validate the Prisma schema.' }],
  dependencies: ['env'],
  enhances: ['auth'],
  adapters: ['node-adapter'],
  ownership: {
    files: [],
    dependencies: ['@prisma/client', 'prisma'],
    scripts: ['db:generate', 'db:migrate', 'db:studio'],
  },
};
