import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand, runKiln } from './cli-runner.js';

const tempRoots: string[] = [];

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-post-deploy-'));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

describe('post-deploy new project journey', () => {
  test('PD-10 through PD-19 onboard env + auth and build', async () => {
    const parent = await createWorkspace();
    // PD-10 create scaffolds Next.js app router files
    const createResult = runKiln(['create', 'upgrade-app'], parent);
    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain("Created kiln project 'upgrade-app'");

    const projectDir = join(parent, 'upgrade-app');
    expect(await readFile(join(projectDir, 'src/app/layout.tsx'), 'utf8')).toContain('RootLayout');
    expect(await readFile(join(projectDir, 'next.config.ts'), 'utf8')).toContain('NextConfig');

    // PD-11 dry-run add env does not write files
    const dryRun = runKiln(['add', 'env', '--dry-run'], projectDir);
    expect(dryRun.exitCode).toBe(0);
    expect(dryRun.stdout).toContain('Mode: dry-run');
    await expect(readFile(join(projectDir, '.env.example'), 'utf8')).rejects.toThrow();

    const install = runCommand('bun', ['install'], projectDir);
    expect(install.exitCode).toBe(0);

    // PD-12 add env creates DATABASE_URL in .env.example
    const addEnv = runKiln(['add', 'env'], projectDir);
    expect(addEnv.exitCode).toBe(0);
    expect(await readFile(join(projectDir, '.env.example'), 'utf8')).toContain(
      'DATABASE_URL=postgres://localhost:5432/app'
    );

    const addCustom = runKiln(['add', 'env', '--var', 'API_URL=https://api.example.com'], projectDir);
    expect(addCustom.exitCode).toBe(0);
    const envAfterCustom = await readFile(join(projectDir, '.env.example'), 'utf8');
    // PD-13 add env --var merges custom keys
    expect(envAfterCustom).toContain('DATABASE_URL=');
    expect(envAfterCustom).toContain('API_URL=https://api.example.com');

    const addAuth = runKiln(['add', 'auth'], projectDir);
    expect(addAuth.exitCode).toBe(0);
    // PD-14 add auth preserves package.json and env vars

    const packageJson = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8')) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(packageJson.name).toBe('upgrade-app');
    expect(packageJson.scripts.build).toBe('next build');
    expect(packageJson.dependencies.next).toBe('^15.0.0');
    expect(packageJson.dependencies.react).toBe('^19.0.0');
    expect(packageJson.dependencies['next-auth']).toBe('^5.0.0-beta.32');

    const envAfterAuth = await readFile(join(projectDir, '.env.example'), 'utf8');
    expect(envAfterAuth).toContain('DATABASE_URL=');
    expect(envAfterAuth).toContain('AUTH_SECRET=replace-me');
    expect(envAfterAuth).toContain('API_URL=https://api.example.com');

    expect(await readFile(join(projectDir, 'src/auth.ts'), 'utf8')).toContain('NextAuth');
    expect(await readFile(join(projectDir, 'src/middleware.ts'), 'utf8')).toContain('from "./auth"');

    const ownership = JSON.parse(await readFile(join(projectDir, '.kiln/ownership.json'), 'utf8')) as {
      ownership: {
        files: Array<{ filePath: string; ownerCapabilityId: string }>;
        dependencies: Array<{ name: string; ownerCapabilityId: string }>;
        envVars: Array<{ name: string; ownerCapabilityId: string }>;
      };
    };
    const fileOwners = Object.fromEntries(
      ownership.ownership.files.map((entry) => [entry.filePath, entry.ownerCapabilityId])
    );
    expect(fileOwners['.env.example']).toBe('env');
    expect(fileOwners['src/auth.ts']).toBe('auth');
    expect(fileOwners['src/middleware.ts']).toBe('auth');
    // PD-15 ownership.json tracks env and auth resources
    expect(ownership.ownership.dependencies.some((entry) => entry.name === 'next-auth')).toBe(true);
    expect(ownership.ownership.envVars.map((entry) => entry.name).sort()).toEqual(
      ['API_URL', 'AUTH_SECRET', 'DATABASE_URL'].sort()
    );

    const inspect = runKiln(['inspect'], projectDir);
    expect(inspect.exitCode).toBe(0);
    // PD-16 inspect reports Next.js app router project
    expect(inspect.stdout).toContain('name: upgrade-app');
    expect(inspect.stdout).toContain('nextjs: yes');
    expect(inspect.stdout).toContain('nextRouter: app');
    expect(inspect.stdout).toContain('file src/auth.ts -> auth');

    const doctor = runKiln(['doctor'], projectDir);
    expect(doctor.exitCode).toBe(0);
    // PD-17 doctor passes on generated project
    expect(doctor.stdout).toContain('[pass] package-json-health: valid');
    expect(doctor.stdout).not.toContain('[fail]');

    const reAddEnv = runKiln(['add', 'env'], projectDir);
    expect(reAddEnv.exitCode).toBe(0);
    // PD-18 re-running add env is a no-op
    expect(reAddEnv.stdout).toContain('no changes');

    const build = runCommand('bun', ['run', 'build'], projectDir);
    expect(build.exitCode).toBe(0);
    // PD-19 generated app production-builds
    expect(build.output).toContain('Compiled successfully');
  }, 180000);
});
