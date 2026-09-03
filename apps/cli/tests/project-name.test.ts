import { describe, expect, test } from 'bun:test';
import { validateProjectName } from '../src/validation/project-name.js';

describe('validateProjectName', () => {
  test('accepts npm-safe lowercase names', () => {
    expect(validateProjectName('my-app')).toBe('my-app');
    expect(validateProjectName('app_1')).toBe('app_1');
    expect(validateProjectName('a')).toBe('a');
  });

  test('rejects empty names', () => {
    expect(() => validateProjectName('')).toThrow('Project name is required');
    expect(() => validateProjectName('   ')).toThrow('Project name is required');
  });

  test('rejects invalid characters and casing', () => {
    expect(() => validateProjectName('My App')).toThrow('Invalid project name');
    expect(() => validateProjectName('weird name')).toThrow('Invalid project name');
    expect(() => validateProjectName('.hidden')).toThrow('Invalid project name');
    expect(() => validateProjectName('-leading')).toThrow('Invalid project name');
  });
});
