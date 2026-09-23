import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { detectNextJs, detectPackageManager } from '@kiln/node-adapter';
import { OwnershipTracker } from '@kiln/core';
import { saveOwnershipTracker } from '@kiln/project-model';
import { validateProjectName } from '../validation/project-name.js';
import { ensureTargetAvailable } from '../project.js';

/** Owner id used for files discovered on disk during `kiln init --existing`. */
export const EXTERNAL_OWNER = 'external';

const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.kiln',
  'dist',
  'build',
  'out',
  '.turbo',
  'coverage',
]);

export async function runInit(
  targetDir: string,
  projectName: string,
  dryRun = false
): Promise<void> {
  const name = validateProjectName(projectName);
  await ensureTargetAvailable(targetDir, 'project');

  if (dryRun) {
    console.log(`Dry run: would create kiln project '${name}' at ${targetDir}`);
    return;
  }

  await mkdir(targetDir, { recursive: true });
  await mkdir(join(targetDir, 'src', 'app'), { recursive: true });

  const packageJson = {
    name,
    version: '0.0.0',
    private: true,
    packageManager: 'bun@1.3.14',
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^25.9.1',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
    },
  };

  const tsconfig = {
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
    exclude: ['node_modules'],
  };

  const pageSource = `export default function Home() {
  return <main>Kiln project</main>;
}
`;

  const layoutSource = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

  const nextConfigSource = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
`;

  const nextEnvSource = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`;

  const gitignore = `node_modules
.next
.env
.env.local
.kiln/*.tmp*
`;

  await writeFile(join(targetDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(targetDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
  await writeFile(join(targetDir, 'next.config.ts'), nextConfigSource);
  await writeFile(join(targetDir, 'next-env.d.ts'), nextEnvSource);
  await writeFile(join(targetDir, 'src', 'app', 'page.tsx'), pageSource);
  await writeFile(join(targetDir, 'src', 'app', 'layout.tsx'), layoutSource);
  await writeFile(join(targetDir, '.gitignore'), gitignore);

  console.log(`Created kiln project '${name}' at ${targetDir}`);
  console.log('Next steps:');
  console.log('  bun install');
  console.log('  kiln add env');
  console.log('  kiln add auth');
}

/**
 * Adopts an existing, non-kiln-created project: detects its shape and seeds
 * `.kiln/ownership.json` with every file already on disk marked as owned by
 * `external`, so a later `kiln add` refuses to overwrite it (ownership
 * conflict) instead of silently clobbering hand-written source. Writes no
 * project source files.
 */
export async function runInitExisting(rootPath: string, dryRun = false): Promise<void> {
  const nextInfo = await detectNextJs(rootPath);
  if (!nextInfo.detected) {
    throw new Error(
      `No Next.js project found at '${rootPath}'. 'kiln init --existing' requires an existing Next.js app (a 'next' dependency in package.json).`
    );
  }

  const packageManager = await detectPackageManager(rootPath);
  const files = await listProjectFiles(rootPath);

  console.log(`Detected Next.js ${nextInfo.version ?? '(unknown version)'} project at ${rootPath}`);
  console.log(`  router: ${nextInfo.router ?? 'unknown'}`);
  console.log(`  language: ${nextInfo.typescript ? 'TypeScript' : 'JavaScript'}`);
  console.log(`  package manager: ${packageManager.kind}`);
  console.log(`  files detected: ${files.length}`);

  if (dryRun) {
    console.log(`Dry run: would seed .kiln/ownership.json marking ${files.length} file(s) as external`);
    return;
  }

  const tracker = new OwnershipTracker();
  for (const filePath of files) {
    tracker.registerFile(filePath, EXTERNAL_OWNER);
  }

  await saveOwnershipTracker(tracker, rootPath);
  console.log(`Seeded .kiln/ownership.json (${files.length} file(s) marked as external)`);
  console.log('Next steps:');
  console.log('  kiln add env');
  console.log('  kiln add auth');
}

/** Recursively lists project files as POSIX-style paths relative to `rootPath`, skipping build/dependency directories. */
async function listProjectFiles(rootPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          await walk(join(directory, entry.name));
        }
        continue;
      }

      if (entry.isFile()) {
        const absolutePath = join(directory, entry.name);
        results.push(relative(rootPath, absolutePath).split(sep).join('/'));
      }
    }
  }

  await walk(rootPath);
  return results.sort();
}
