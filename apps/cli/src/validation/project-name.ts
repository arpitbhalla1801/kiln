const PROJECT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-_]*[a-z0-9])?$/;
const MAX_PROJECT_NAME_LENGTH = 214;

export function validateProjectName(projectName: string): string {
  const name = projectName.trim();

  if (!name) {
    throw new Error('Project name is required. Usage: kiln init <name>');
  }

  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(`Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters.`);
  }

  if (!PROJECT_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid project name '${projectName}'. Use lowercase letters, numbers, hyphens, or underscores (e.g. my-app).`
    );
  }

  return name;
}
