import { access, readdir } from 'node:fs/promises';
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

/**
 * Ensures a target directory is available for scaffolding a new project or plugin:
 * either it doesn't exist yet, or it exists and is empty. Throws otherwise.
 *
 * @param targetDir the directory being scaffolded into
 * @param thing a noun describing what's being created, used in error messages (e.g. "project", "plugin")
 */
export async function ensureTargetAvailable(targetDir: string, thing: string): Promise<void> {
  try {
    await access(targetDir);
  } catch {
    return;
  }

  let entries: string[] = [];
  try {
    entries = await readdir(targetDir);
  } catch {
    throw new Error(
      `Cannot create ${thing} at '${targetDir}' because a file with that name already exists.`
    );
  }

  if (entries.length > 0) {
    throw new Error(
      `Target directory '${targetDir}' already exists and is not empty. Choose a new name or remove the directory.`
    );
  }
}
