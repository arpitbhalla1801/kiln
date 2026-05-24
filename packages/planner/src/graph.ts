export interface GraphNode<T = unknown> {
  id: string;
  dependencies: string[];
  data?: T;
}

export class DependencyGraph<T = unknown> {
  private nodes: Map<string, GraphNode<T>> = new Map();

  addNode(node: GraphNode<T>): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.nodes.set(node.id, { ...node, dependencies: [...node.dependencies] });
  }

  addDependency(from: string, to: string): void {
    const node = this.nodes.get(from);
    if (!node) {
      throw new Error(`Node ${from} not found`);
    }
    if (!this.nodes.has(to)) {
      throw new Error(`Node ${to} not found`);
    }
    if (!node.dependencies.includes(to)) {
      node.dependencies.push(to);
    }
  }

  resolveOrder(): GraphNode<T>[] {
    const order: GraphNode<T>[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Sort alphabetically to ensure deterministic evaluation order
    const nodeIds = Array.from(this.nodes.keys()).sort();

    const visit = (id: string, path: string[]) => {
      if (visiting.has(id)) {
        const cyclePath = [...path, id].join(' -> ');
        throw new Error(`Dependency cycle detected: ${cyclePath}`);
      }
      if (visited.has(id)) {
        return;
      }

      visiting.add(id);
      path.push(id);

      const node = this.nodes.get(id);
      if (!node) {
        throw new Error(`Node ${id} not found during traversal`);
      }

      // Sort dependencies alphabetically to ensure deterministic resolution output
      const deps = [...node.dependencies].sort();
      for (const depId of deps) {
        visit(depId, path);
      }

      path.pop();
      visiting.delete(id);
      visited.add(id);
      order.push(node);
    };

    for (const id of nodeIds) {
      if (!visited.has(id)) {
        visit(id, []);
      }
    }

    return order;
  }
}
