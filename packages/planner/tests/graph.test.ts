import { describe, expect, test } from 'bun:test';
import { DependencyGraph } from '../src/graph.js';

describe('DependencyGraph', () => {
  test('graph resolves deterministic order', () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: 'A', dependencies: ['B', 'C'] });
    graph.addNode({ id: 'B', dependencies: ['D'] });
    graph.addNode({ id: 'C', dependencies: ['D'] });
    graph.addNode({ id: 'D', dependencies: [] });

    const order = graph.resolveOrder();
    const orderIds = order.map(n => n.id);
    
    // D has no deps, so it evaluates first.
    // Deterministic DFS process sorted alphabetically:
    // Visit A -> deps B, C
    //  -> Visit B -> deps D
    //      -> Visit D -> no deps, added to order: ['D']
    //      <- B finished, added to order: ['D', 'B']
    //  -> Visit C -> deps D
    //      -> D already visited
    //      <- C finished, added to order: ['D', 'B', 'C']
    //  <- A finished, added to order: ['D', 'B', 'C', 'A']
    expect(orderIds).toEqual(['D', 'B', 'C', 'A']);
  });

  test('cycles throw errors', () => {
    const graph = new DependencyGraph();
    graph.addNode({ id: 'A', dependencies: ['B'] });
    graph.addNode({ id: 'B', dependencies: ['C'] });
    graph.addNode({ id: 'C', dependencies: ['A'] });

    expect(() => graph.resolveOrder()).toThrow('Dependency cycle detected: A -> B -> C -> A');
  });
  
  test('unresolved dependencies throw when added via method', () => {
      const graph = new DependencyGraph();
      graph.addNode({ id: 'A', dependencies: [] });
      expect(() => graph.addDependency('A', 'B')).toThrow('Node B not found');
  });
});
