import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

interface WriteKilnMetadataOptions {
  appName: string;
  projectRoot: string;
}

export async function writeKilnMetadata({
  appName,
  projectRoot,
}: WriteKilnMetadataOptions): Promise<void> {
  const kilnDir = join(projectRoot, '.kiln');
  await mkdir(kilnDir, { recursive: true });

  const projectJson = {
    kilnVersion: '0.1.0',
    adapters: {
      frontend: 'node-nextjs',
    },
    capabilities: ['app'],
    workspace: {
      projects: {
        [appName]: `apps/${appName}`,
      },
    },
  };

  const kilnLock = {
    providers: {
      app: 'next',
    },
    versions: {},
  };

  await writeFile(
    join(kilnDir, 'project.json'),
    JSON.stringify(projectJson, null, 2),
    'utf-8'
  );

  await writeFile(
    join(kilnDir, 'kiln.lock'),
    JSON.stringify(kilnLock, null, 2),
    'utf-8'
  );
}