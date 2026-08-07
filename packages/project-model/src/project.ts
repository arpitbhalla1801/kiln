import type { CapabilityId } from '@kiln/core';
import type {
  DependencyOwnership,
  EnvVarOwnership,
  EnvVarName,
  KilnProjectModel,
  OwnershipMetadata,
  ProjectDependency,
  ProjectEnvVar,
  ProjectFile,
  ProjectFilePath,
  ProjectScript,
  ScriptName,
  ScriptOwnership,
} from './types.js';

/** Create an empty project model for a new kiln project. */
export function createEmptyProjectModel(
  name: string,
  rootPath: string,
  version = '0.1.0'
): KilnProjectModel {
  return {
    name,
    version,
    rootPath,
    capabilities: [],
    files: [],
    dependencies: [],
    scripts: [],
    envVars: [],
    ownership: createEmptyOwnershipMetadata(),
  };
}

/** Create empty ownership metadata with all collections initialized. */
export function createEmptyOwnershipMetadata(): OwnershipMetadata {
  return {
    files: [],
    dependencies: [],
    scripts: [],
    envVars: [],
    metadata: [],
  };
}

/** Add or update a file in the project model. */
export function upsertProjectFile(model: KilnProjectModel, file: ProjectFile): KilnProjectModel {
  const files = model.files.filter((entry) => entry.path !== file.path);
  files.push(file);
  files.sort((left, right) => left.path.localeCompare(right.path));

  return {
    ...model,
    files,
  };
}

/** Add or update a dependency in the project model. */
export function upsertProjectDependency(
  model: KilnProjectModel,
  dependency: ProjectDependency
): KilnProjectModel {
  const dependencies = model.dependencies.filter((entry) => entry.name !== dependency.name);
  dependencies.push(dependency);
  dependencies.sort((left, right) => left.name.localeCompare(right.name));

  const ownership = registerDependencyOwnership(
    model.ownership,
    dependency.name,
    dependency.ownerCapabilityId
  );

  return {
    ...model,
    dependencies,
    ownership,
  };
}

/** Add or update a script in the project model. */
export function upsertProjectScript(model: KilnProjectModel, script: ProjectScript): KilnProjectModel {
  const scripts = model.scripts.filter((entry) => entry.name !== script.name);
  scripts.push(script);
  scripts.sort((left, right) => left.name.localeCompare(right.name));

  const ownership = registerScriptOwnership(model.ownership, script.name, script.ownerCapabilityId);

  return {
    ...model,
    scripts,
    ownership,
  };
}

/** Add or update an environment variable in the project model. */
export function upsertProjectEnvVar(model: KilnProjectModel, envVar: ProjectEnvVar): KilnProjectModel {
  const envVars = model.envVars.filter((entry) => entry.name !== envVar.name);
  envVars.push(envVar);
  envVars.sort((left, right) => left.name.localeCompare(right.name));

  const ownership = registerEnvVarOwnership(model.ownership, envVar.name, envVar.ownerCapabilityId);

  return {
    ...model,
    envVars,
    ownership,
  };
}

/** Register file ownership on the project model. */
export function registerFileOwnership(
  model: KilnProjectModel,
  filePath: ProjectFilePath,
  ownerCapabilityId: CapabilityId
): KilnProjectModel {
  const ownership = {
    ...model.ownership,
    files: sortFileOwnership([
      ...model.ownership.files.filter((entry) => entry.filePath !== filePath),
      { filePath, ownerCapabilityId },
    ]),
  };

  return {
    ...model,
    ownership,
  };
}

/** Build ownership metadata from entity ownership fields on the model. */
export function ownershipFromProjectModel(model: KilnProjectModel): OwnershipMetadata {
  const dependencies: DependencyOwnership[] = [];
  const scripts: ScriptOwnership[] = [];
  const envVars: EnvVarOwnership[] = [];

  for (const dependency of model.dependencies) {
    if (dependency.ownerCapabilityId) {
      dependencies.push({
        name: dependency.name,
        ownerCapabilityId: dependency.ownerCapabilityId,
      });
    }
  }

  for (const script of model.scripts) {
    if (script.ownerCapabilityId) {
      scripts.push({
        name: script.name,
        ownerCapabilityId: script.ownerCapabilityId,
      });
    }
  }

  for (const envVar of model.envVars) {
    if (envVar.ownerCapabilityId) {
      envVars.push({
        name: envVar.name,
        ownerCapabilityId: envVar.ownerCapabilityId,
      });
    }
  }

  return {
    files: sortFileOwnership([...model.ownership.files]),
    dependencies: sortDependencyOwnership(dependencies),
    scripts: sortScriptOwnership(scripts),
    envVars: sortEnvVarOwnership(envVars),
    metadata: sortMetadataOwnership([...model.ownership.metadata]),
  };
}

function registerDependencyOwnership(
  ownership: OwnershipMetadata,
  name: string,
  ownerCapabilityId?: CapabilityId
): OwnershipMetadata {
  const dependencies = ownership.dependencies.filter((entry) => entry.name !== name);
  if (ownerCapabilityId) {
    dependencies.push({ name, ownerCapabilityId });
  }

  return {
    ...ownership,
    dependencies: sortDependencyOwnership(dependencies),
  };
}

function registerScriptOwnership(
  ownership: OwnershipMetadata,
  name: ScriptName,
  ownerCapabilityId?: CapabilityId
): OwnershipMetadata {
  const scripts = ownership.scripts.filter((entry) => entry.name !== name);
  if (ownerCapabilityId) {
    scripts.push({ name, ownerCapabilityId });
  }

  return {
    ...ownership,
    scripts: sortScriptOwnership(scripts),
  };
}

function registerEnvVarOwnership(
  ownership: OwnershipMetadata,
  name: EnvVarName,
  ownerCapabilityId?: CapabilityId
): OwnershipMetadata {
  const envVars = ownership.envVars.filter((entry) => entry.name !== name);
  if (ownerCapabilityId) {
    envVars.push({ name, ownerCapabilityId });
  }

  return {
    ...ownership,
    envVars: sortEnvVarOwnership(envVars),
  };
}

function sortFileOwnership(files: OwnershipMetadata['files']): OwnershipMetadata['files'] {
  return [...files].sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function sortDependencyOwnership(
  dependencies: DependencyOwnership[]
): DependencyOwnership[] {
  return [...dependencies].sort((left, right) => left.name.localeCompare(right.name));
}

function sortScriptOwnership(scripts: ScriptOwnership[]): ScriptOwnership[] {
  return [...scripts].sort((left, right) => left.name.localeCompare(right.name));
}

function sortEnvVarOwnership(envVars: EnvVarOwnership[]): EnvVarOwnership[] {
  return [...envVars].sort((left, right) => left.name.localeCompare(right.name));
}

function sortMetadataOwnership(metadata: OwnershipMetadata['metadata']): OwnershipMetadata['metadata'] {
  return [...metadata].sort((left, right) => left.key.localeCompare(right.key));
}
