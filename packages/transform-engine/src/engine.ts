import { FileOperation, OperationSummary, TransformPlan, TransformOptions } from './types.js';
import { FilesystemPersistence } from './persistence.js';
import { VirtualFilesystem } from './vfs.js';

export class TransformEngine {
  private vfs: VirtualFilesystem;
  private operationMetadata: Map<string, Pick<FileOperation, 'diffPreview'>>;
  private persistence: FilesystemPersistence;

  constructor(vfs?: VirtualFilesystem, persistence?: FilesystemPersistence) {
    this.vfs = vfs ?? new VirtualFilesystem();
    this.operationMetadata = new Map();
    this.persistence = persistence ?? new FilesystemPersistence();
  }

  getVirtualFilesystem(): VirtualFilesystem {
    return this.vfs;
  }

  getFilesystemPersistence(): FilesystemPersistence {
    return this.persistence;
  }

  queueOperation(operation: FileOperation) {
    const normalizedPath = operation.filePath.replace(/\\/g, '/');

    if (operation.type === 'create' || operation.type === 'modify') {
      this.vfs.write(normalizedPath, operation.content ?? '');
    } else if (operation.type === 'delete') {
      this.vfs.delete(normalizedPath);
    }

    if (operation.diffPreview !== undefined) {
      this.operationMetadata.set(normalizedPath, { diffPreview: operation.diffPreview });
    }
  }

  getPlanPreview(): TransformPlan {
    const diff = this.vfs.getDiff();
    const operations: FileOperation[] = diff.entries.map((entry) => {
      const metadata = this.operationMetadata.get(entry.path);

      return {
        type: entry.type,
        filePath: entry.path,
        content: entry.after,
        diffPreview: metadata?.diffPreview,
      };
    });

    return {
      operations,
      summary: diff.summary as OperationSummary,
    };
  }

  async execute(options: TransformOptions = {}): Promise<TransformPlan> {
    const plan = this.getPlanPreview();

    if (options.dryRun) {
      return plan;
    }

    await this.persistence.persistVirtualFilesystem(this.vfs, {
      rootDir: options.rootDir,
    });

    this.vfs.commit();
    this.operationMetadata.clear();

    return plan;
  }
}
