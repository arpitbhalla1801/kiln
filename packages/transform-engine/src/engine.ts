import { FileOperation, OperationSummary, TransformPlan, TransformOptions } from './types.js';
import { VirtualFilesystem } from './vfs.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class TransformEngine {
  private vfs: VirtualFilesystem;
  private operationMetadata: Map<string, Pick<FileOperation, 'diffPreview'>>;

  constructor(vfs?: VirtualFilesystem) {
    this.vfs = vfs ?? new VirtualFilesystem();
    this.operationMetadata = new Map();
  }

  getVirtualFilesystem(): VirtualFilesystem {
    return this.vfs;
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

    for (const op of plan.operations) {
      if (op.type === 'create' || op.type === 'modify') {
        const dir = path.dirname(op.filePath);
        await fs.mkdir(dir, { recursive: true });
        if (op.content !== undefined) {
          await fs.writeFile(op.filePath, op.content, 'utf8');
        }
      } else if (op.type === 'delete') {
        try {
          await fs.unlink(op.filePath);
        } catch (error: unknown) {
          if (!isNodeError(error) || error.code !== 'ENOENT') {
            throw error;
          }
        }
      }
    }

    this.vfs.commit();
    this.operationMetadata.clear();

    return plan;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
