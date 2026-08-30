import { access } from 'node:fs/promises';
import { join } from 'node:path';

export async function isKilnProject(rootPath: string): Promise<boolean> {
  try {
    await access(join(rootPath, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

export async function resolveProjectRoot(cwd: string): Promise<string> {
  if (await isKilnProject(cwd)) {
    return cwd;
  }

  throw new Error(
    'No kiln project found. Run `kiln create` or run this command from a project with package.json.'
  );
}
