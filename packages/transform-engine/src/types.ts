import type { VfsDiffSummary } from './vfs.js';

export interface FileOperation {
  type: 'create' | 'modify' | 'delete';
  filePath: string;
  content?: string;
  before?: string;
  diffPreview?: string;
}

/** Structurally identical to VfsDiffSummary (aliased to avoid duplication). */
export type OperationSummary = VfsDiffSummary;

export interface TransformPlan {
  operations: FileOperation[];
  summary: OperationSummary;
}

export interface TransformOptions {
  dryRun?: boolean;
  rootDir?: string;
}
