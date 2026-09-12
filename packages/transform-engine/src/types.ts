export interface FileOperation {
  type: 'create' | 'modify' | 'delete';
  filePath: string;
  content?: string;
  before?: string;
  diffPreview?: string;
}

export interface OperationSummary {
  created: number;
  modified: number;
  deleted: number;
  total: number;
}

export interface TransformPlan {
  operations: FileOperation[];
  summary: OperationSummary;
}

export interface TransformOptions {
  dryRun?: boolean;
  rootDir?: string;
}
