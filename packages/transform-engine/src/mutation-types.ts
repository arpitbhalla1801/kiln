export type JsonMutationOperationType = 'set' | 'delete' | 'merge';

export interface JsonSetMutation {
  type: 'set';
  path: string;
  value: unknown;
}

export interface JsonDeleteMutation {
  type: 'delete';
  path: string;
}

export interface JsonMergeMutation {
  type: 'merge';
  path: string;
  value: Record<string, unknown>;
}

export type JsonAstMutation = JsonSetMutation | JsonDeleteMutation | JsonMergeMutation;

export interface PackageJsonMergeInput {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  removeDependencies?: string[];
  removeDevDependencies?: string[];
  removeScripts?: string[];
}
