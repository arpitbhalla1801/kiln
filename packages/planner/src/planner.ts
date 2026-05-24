import { DependencyGraph } from './graph.js';
import { CapabilityManifest, ExecutionPlan } from './types.js';

export class ProjectPlanner {
  private manifests: Map<string, CapabilityManifest> = new Map();

  addManifest(manifest: CapabilityManifest): void {
    if (this.manifests.has(manifest.id)) {
      throw new Error(`Manifest with id ${manifest.id} already exists`);
    }
    this.manifests.set(manifest.id, manifest);
  }

  generatePlan(): ExecutionPlan {
    const graph = new DependencyGraph<CapabilityManifest>();

    // Sort to ensure maps are iterated deterministically
    const sortedIds = Array.from(this.manifests.keys()).sort();

    for (const id of sortedIds) {
      const manifest = this.manifests.get(id);
      if (manifest) {
        graph.addNode({
          id: manifest.id,
          dependencies: manifest.dependencies,
          data: manifest,
        });
      }
    }

    // DependencyGraph resolves deterministically, throwing on cycles
    const orderedNodes = graph.resolveOrder();
    
    const capabilities = orderedNodes.map((node) => {
      if (!node.data) {
        throw new Error(`Node ${node.id} is missing manifest data.`);
      }
      return node.data;
    });

    const transforms: string[] = [];
    for (const cap of capabilities) {
      if (cap.transforms) {
        // Collect transforms in the exact resolved order of capabilities
        transforms.push(...cap.transforms);
      }
    }

    return {
      capabilities,
      transforms,
    };
  }
}
