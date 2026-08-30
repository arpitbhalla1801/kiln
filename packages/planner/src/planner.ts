import { CapabilityManifest, ExecutionPlan, capabilityFromManifest } from '@kiln/core';
import { DependencyGraph } from './graph.js';

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
      return capabilityFromManifest(node.data);
    });

    const transforms: string[] = [];
    for (const node of orderedNodes) {
      if (node.data?.transforms) {
        transforms.push(...node.data.transforms);
      }

      if (node.data?.transformDefinitions) {
        transforms.push(...node.data.transformDefinitions.map((transform) => transform.id));
      }
    }

    return {
      capabilities,
      transforms,
    };
  }
}
