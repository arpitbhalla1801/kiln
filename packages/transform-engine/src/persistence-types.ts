export interface PersistenceOptions {
  /** Base directory for relative file paths. */
  rootDir?: string;
  encoding?: BufferEncoding;
}

export interface PersistenceResult {
  written: string[];
  deleted: string[];
}

export interface PersistableFileOperation {
  type: 'create' | 'modify' | 'delete';
  filePath: string;
  content?: string;
}
