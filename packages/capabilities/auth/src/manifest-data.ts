/**
 * Embedded mirror of ../kiln.manifest.json.
 *
 * Loaded as a plain object instead of read from disk at runtime so the
 * capability works when bundled into a single-file CLI (no import.meta.url
 * or __dirname-based path resolution, and no need to ship the .json file
 * alongside the bundle). Keep in sync with kiln.manifest.json.
 */
export const AUTH_MANIFEST = {
  id: 'auth',
  name: 'Authentication',
  version: '1.0.0',
  dependencies: ['env'],
  adapters: ['node-adapter'],
  ownership: {
    files: [],
    dependencies: ['next-auth'],
  },
};
