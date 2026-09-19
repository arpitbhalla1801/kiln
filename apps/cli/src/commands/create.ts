import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateProjectName } from '../validation/project-name.js';
import { ensureTargetAvailable } from '../project.js';

export async function runCreate(
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
