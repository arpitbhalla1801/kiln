import type {
  EnvMutationTransform,
  EnvVariableDefinition,
  FileCreateTransform,
  FileDeleteTransform,
  FilePatchTransform,
  JsonMutationOperation,
  JsonMutationTransform,
  PackageJsonMutationTransform,
  TransformPipeline,
  TypedTransform,
} from './transform-types.js';

export function fileCreate(
  id: string,
  filePath: string,
  content: string,
  name?: string
): FileCreateTransform {
  return { id, name, type: 'file-create', filePath, content };
}

export function filePatch(
  id: string,
  filePath: string,
  search: string,
  replace: string,
  name?: string
): FilePatchTransform {
  return { id, name, type: 'file-patch', filePath, search, replace };
}

export function fileDelete(id: string, filePath: string, name?: string): FileDeleteTransform {
  return { id, name, type: 'file-delete', filePath };
}

export function jsonMutation(
  id: string,
  filePath: string,
  path: string,
  value?: unknown,
  operation: JsonMutationOperation = 'set',
  name?: string
): JsonMutationTransform {
  return { id, name, type: 'json-mutation', filePath, path, value, operation };
}

export function packageJsonMutation(
  id: string,
  mutations: Omit<PackageJsonMutationTransform, 'id' | 'type'>,
  name?: string
): PackageJsonMutationTransform {
  return { id, name, type: 'package-json-mutation', ...mutations };
}

export function envMutation(
  id: string,
  filePath: string,
  variables: Record<string, string | EnvVariableDefinition>,
  name?: string,
  removeVariables?: string[],
  section?: string,
  preserveExistingValues?: boolean
): EnvMutationTransform {
  return {
    id,
    name,
    type: 'env-mutation',
    filePath,
    variables,
    removeVariables,
    section,
    preserveExistingValues,
  };
}

/** Compose transforms into an ordered pipeline. */
export function composeTransforms(transforms: TypedTransform[]): TransformPipeline {
  return [...transforms];
}

/** Fluent builder for composable transform pipelines. */
export class TransformPipelineBuilder {
  private transforms: TypedTransform[] = [];

  add(transform: TypedTransform): this {
    this.transforms.push(transform);
    return this;
  }

  fileCreate(id: string, filePath: string, content: string, name?: string): this {
    return this.add(fileCreate(id, filePath, content, name));
  }

  filePatch(id: string, filePath: string, search: string, replace: string, name?: string): this {
    return this.add(filePatch(id, filePath, search, replace, name));
  }

  fileDelete(id: string, filePath: string, name?: string): this {
    return this.add(fileDelete(id, filePath, name));
  }

  jsonMutation(
    id: string,
    filePath: string,
    jsonPath: string,
    value?: unknown,
    operation: JsonMutationOperation = 'set',
    name?: string
  ): this {
    return this.add(jsonMutation(id, filePath, jsonPath, value, operation, name));
  }

  packageJsonMutation(
    id: string,
    mutations: Omit<PackageJsonMutationTransform, 'id' | 'type'>,
    name?: string
  ): this {
    return this.add(packageJsonMutation(id, mutations, name));
  }

  envMutation(
    id: string,
    filePath: string,
    variables: Record<string, string | EnvVariableDefinition>,
    name?: string,
    removeVariables?: string[],
    section?: string,
    preserveExistingValues?: boolean
  ): this {
    return this.add(
      envMutation(id, filePath, variables, name, removeVariables, section, preserveExistingValues)
    );
  }

  build(): TransformPipeline {
    return composeTransforms(this.transforms);
  }
}

export function createTransformPipeline(): TransformPipelineBuilder {
  return new TransformPipelineBuilder();
}
