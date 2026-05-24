import { FileOperation, OperationSummary, TransformPlan, TransformOptions } from './types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class TransformEngine {
  private operations: FileOperation[] = [];

  queueOperation(operation: FileOperation) {
    this.operations.push(operation);
  }

  getPlanPreview(): TransformPlan {
    const summary: OperationSummary = {
      created: 0,
      modified: 0,
      deleted: 0,
      total: this.operations.length,
    };

    for (const op of this.operations) {
      if (op.type === 'create') summary.created++;
      if (op.type === 'modify') summary.modified++;
      if (op.type === 'delete') summary.deleted++;
    }

    return {
      operations: [...this.operations],
      summary,
    };
  }

  async execute(options: TransformOptions = {}): Promise<TransformPlan> {
    const plan = this.getPlanPreview();

    // No-write mode
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
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
        }
      }
    }

    return plan;
  }
}
