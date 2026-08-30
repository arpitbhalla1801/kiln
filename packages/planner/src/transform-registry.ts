import type {
  Capability,
  CapabilityId,
  CapabilityManifest,
  ExecutionPlan,
  Transform,
  TransformId,
} from '@kiln/core';

/** Registry of transform definitions keyed by transform ID. */
export class TransformRegistry {
  private transforms = new Map<TransformId, Transform>();

  register(transform: Transform): void {
    if (this.transforms.has(transform.id)) {
      return;
    }

    this.transforms.set(transform.id, transform);
  }

  registerAll(transforms: Transform[]): void {
    for (const transform of transforms) {
      this.register(transform);
    }
  }

  registerManifest(manifest: CapabilityManifest): void {
    if (manifest.transformDefinitions) {
      this.registerAll(manifest.transformDefinitions);
    }
  }

  registerCapability(capability: Capability): void {
    if (capability.transforms) {
      this.registerAll(capability.transforms);
    }
  }

  resolve(transformId: TransformId): Transform {
    const transform = this.transforms.get(transformId);
    if (!transform) {
      throw new Error(`Transform definition not found for id: ${transformId}`);
    }

    return transform;
  }

  resolveAll(transformIds: TransformId[]): Transform[] {
    return transformIds.map((transformId) => this.resolve(transformId));
  }

  has(transformId: TransformId): boolean {
    return this.transforms.has(transformId);
  }
}

export function buildTransformRegistry(
  manifests: CapabilityManifest[],
  capabilities: Capability[] = []
): TransformRegistry {
  const registry = new TransformRegistry();

  for (const manifest of manifests) {
    registry.registerManifest(manifest);
  }

  for (const capability of capabilities) {
    registry.registerCapability(capability);
  }

  return registry;
}

export function collectTransformsFromPlan(
  plan: ExecutionPlan,
  manifests: Map<CapabilityId, CapabilityManifest>
): Transform[] {
  const transforms: Transform[] = [];

  for (const capability of plan.capabilities) {
    if (capability.transforms) {
      transforms.push(...capability.transforms);
    }

    const manifest = manifests.get(capability.id);
    if (manifest?.transformDefinitions) {
      transforms.push(...manifest.transformDefinitions);
    }
  }

  return transforms;
}
