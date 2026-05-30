import { join } from 'path';
import { mkdir } from 'fs/promises';
import { writeKilnMetadata } from '../metadata/writeKilnMetadata';
import { existsSync } from 'fs';

interface CreateNextAppOptions {
    appName: string;
    projectRoot: string;
}

export async function createNextAppWithBun({
    appName,
    projectRoot,
}: CreateNextAppOptions): Promise<void> {
    const appsDir = join(projectRoot, 'apps');
    const appPath = join(appsDir, appName);

    if (existsSync(appPath)) {
        throw new Error(`App already exists: ${appName}`);
    }
    
    await mkdir(appsDir, { recursive: true });

    console.log(`Creating Next.js app: ${appName}...`);

    const result = Bun.spawnSync(
        [
            'bunx',
            'create-next-app@latest',
            appPath,
            '--typescript',
            '--no-git',
            '--yes',
        ],
        {
            stdout: 'inherit',
            stderr: 'inherit',
        }
    );

    if (result.exitCode !== 0) {
        throw new Error(`Failed to create Next.js app: ${appName}`);
    }

    console.log(`Writing Kiln metadata...`);

    await writeKilnMetadata({ appName, projectRoot });

    console.log(`Done. App created at apps/${appName}`);

    console.log(`\n📁 Location:  ${appPath}`);
    console.log(`\u001b]8;;file://${appPath}\u0007Click to open in Finder\u001b]8;;\u0007`);
    console.log(`\n🚀 To start your app:`);
    console.log(`   cd apps/${appName}`);
    console.log(`   bun dev\n`);
}