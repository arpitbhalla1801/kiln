import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const NPM_PACKAGE_NAME_PATTERN =
  /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function validateProjectName(projectName: string): void {
  if (projectName.length === 0 || projectName.length > 214) {
    throw new Error(
      `Invalid project name '${projectName}': must be between 1 and 214 characters.`
    );
  }

  if (!NPM_PACKAGE_NAME_PATTERN.test(projectName)) {
    throw new Error(
      `Invalid project name '${projectName}': must be a valid npm package name ` +
        '(lowercase letters, digits, and - . _ ~, optionally scoped).'
    );
  }
}

async function isNonEmptyDirectory(targetDir: string): Promise<boolean> {
  try {
    const entries = await readdir(targetDir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function runCreate(targetDir: string, projectName: string): Promise<void> {
  validateProjectName(projectName);

  if (await isNonEmptyDirectory(targetDir)) {
    throw new Error(
      `Directory '${targetDir}' already exists and is not empty. ` +
        'Choose a different project name or remove the existing directory first.'
    );
  }

  await mkdir(targetDir, { recursive: true });
  await mkdir(join(targetDir, 'src', 'app'), { recursive: true });

  const packageJson = {
    name: projectName,
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

  const gitignore = `node_modules
.next
.env
.env.local
.kiln/*.tmp*
`;

  await writeFile(join(targetDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(targetDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
  await writeFile(join(targetDir, 'src', 'app', 'page.tsx'), pageSource);
  await writeFile(join(targetDir, '.gitignore'), gitignore);

  console.log(`Created kiln project '${projectName}' at ${targetDir}`);
  console.log('Next steps:');
  console.log('  bun install');
  console.log('  kiln add env');
  console.log('  kiln add auth');
}
