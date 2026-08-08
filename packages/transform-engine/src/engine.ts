import { FileOperation, OperationSummary, TransformPlan, TransformOptions } from './types.js';
import { FilesystemPersistence } from './persistence.js';
import { RollbackManager } from './rollback.js';
import { VirtualFilesystem } from './vfs.js';
import { TransformApplier } from './transform-applier.js';
import type { TransformPipeline, TypedTransform } from './transform-types.js';

export class TransformEngine {
  private vfs: VirtualFilesystem;
  private operationMetadata: Map<string, Pick<FileOperation, 'diffPreview'>>;
  private persistence: FilesystemPersistence;
  private applier: TransformApplier;
  private rollbackManager: RollbackManager;

  constructor(
    vfs?: VirtualFilesystem,
    persistence?: FilesystemPersistence,
    rollbackManager?: RollbackManager
  ) {
    this.vfs = vfs ?? new VirtualFilesystem();
    this.operationMetadata = new Map();
    this.persistence = persistence ?? new FilesystemPersistence();
    this.applier = new TransformApplier();
    this.rollbackManager = rollbackManager ?? new RollbackManager();
  }

  getVirtualFilesystem(): VirtualFilesystem {
    return this.vfs;
  }

  getFilesystemPersistence(): FilesystemPersistence {
    return this.persistence;
  }

  getTransformApplier(): TransformApplier {
    return this.applier;
  }

  getRollbackManager(): RollbackManager {
    return this.rollbackManager;
  }

  queueTransform(transform: TypedTransform): void {
    this.applier.apply(this.vfs, transform);
  }

  queueTransforms(transforms: TransformPipeline): void {
    this.applier.applyAll(this.vfs, transforms);
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

    const rootDir = options.rootDir ?? process.cwd();
    const diff = this.vfs.getDiff();
    const diskSnapshots = await this.rollbackManager.captureDiskSnapshots(rootDir, diff);
    const rollbackSnapshot = this.rollbackManager.createSnapshot(this.vfs, diskSnapshots);

    try {
      await this.persistence.persistVirtualFilesystem(this.vfs, {
        rootDir: options.rootDir,
      });

      this.vfs.commit();
      this.operationMetadata.clear();
      this.rollbackManager.deleteSnapshot(rollbackSnapshot.id);
    } catch (error) {
      await this.rollbackManager.recover(this.vfs, rollbackSnapshot, rootDir);
      this.rollbackManager.deleteSnapshot(rollbackSnapshot.id);
      throw error;
    }

    return plan;
  }
}
