/**
 * Embedded mirror of ../kiln.manifest.json.
 *
 * Loaded as a plain object instead of read from disk at runtime so the
 * capability works when bundled into a single-file CLI (no import.meta.url
 * or __dirname-based path resolution, and no need to ship the .json file
 * alongside the bundle). Keep in sync with kiln.manifest.json.
 */
export const ENV_MANIFEST = {
  id: 'env',
  name: 'Environment Variables',
  version: '1.0.0',
  dependencies: [],
  adapters: ['node-adapter'],
  transformDefinitions: [
    {
      id: 'env-example',
      type: 'env-mutation',
      target: '.env.example',
      payload: {
        variables: {},
      },
    },
  ],
  ownership: {
    files: ['.env.example'],
    envVars: [],
  },
};
