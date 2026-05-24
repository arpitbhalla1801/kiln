import { describe, expect, test, afterAll, beforeAll } from 'bun:test';
import { TransformEngine } from '../src/engine.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('TransformEngine', () => {
  const testDir = path.join(__dirname, 'test-output');

  beforeAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
  });

  test('plan preview generates operation summary and file diff structure', () => {
    const engine = new TransformEngine();
    engine.queueOperation({ type: 'create', filePath: 'a.ts', diffPreview: '+ a' });
    engine.queueOperation({ type: 'modify', filePath: 'b.ts', diffPreview: '~ b' });
    engine.queueOperation({ type: 'delete', filePath: 'c.ts', diffPreview: '- c' });

    const plan = engine.getPlanPreview();
    
    expect(plan.summary).toEqual({
      created: 1,
      modified: 1,
      deleted: 1,
      total: 3
    });

    expect(plan.operations.length).toBe(3);
    expect(plan.operations[0].diffPreview).toBe('+ a');
  });

  test('no-write mode leaves filesystem untouched', async () => {
    const engine = new TransformEngine();
    const filePath = path.join(testDir, 'dryrun.txt');
    
    engine.queueOperation({ 
      type: 'create', 
      filePath, 
      content: 'hello' 
    });

    // Run with dryRun: true
    const result = await engine.execute({ dryRun: true });
    
    expect(result.summary.created).toBe(1);
    
    // Assert filesystem untouched
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  test('executes operations when dryRun is false', async () => {
    const engine = new TransformEngine();
    const filePath = path.join(testDir, 'actual.txt');
    
    engine.queueOperation({ 
      type: 'create', 
      filePath, 
      content: 'world' 
    });

    await engine.execute({ dryRun: false });
    
    // Assert file was created
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toBe('world');
  });
});
