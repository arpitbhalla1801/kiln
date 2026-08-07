import { describe, expect, test } from 'bun:test';
import * as projectModel from '../src/index.js';
import {
  createEmptyProjectModel,
  createEmptyOwnershipMetadata,
  ownershipFromProjectModel,
  registerFileOwnership,
  upsertProjectDependency,
  upsertProjectEnvVar,
  upsertProjectFile,
  upsertProjectScript,
} from '../src/project.js';
import {
  parseOwnershipMetadata,
  serializeOwnershipMetadata,
} from '../src/ownership.js';
import type {
  KilnProjectModel,
  OwnershipMetadata,
  ProjectDependency,
  ProjectEnvVar,
  ProjectFile,
  ProjectScript,
} from '../src/types.js';

describe('project model interfaces', () => {
  test('exports project model types and helpers from package entry', () => {
    expect(projectModel.name).toBe('@kiln/project-model');
    expect(projectModel.createEmptyProjectModel).toBe(createEmptyProjectModel);
    expect(projectModel.serializeOwnershipMetadata).toBe(serializeOwnershipMetadata);
  });

  test('constructs MVP entity interfaces', () => {
    const file: ProjectFile = {
      path: 'src/middleware.ts',
      content: 'export {}',
      exists: true,
    };

    const dependency: ProjectDependency = {
      name: 'next-auth',
      version: '^5.0.0',
      ownerCapabilityId: 'auth',
    };

    const script: ProjectScript = {
      name: 'dev',
      command: 'next dev',
      ownerCapabilityId: 'core',
    };

    const envVar: ProjectEnvVar = {
      name: 'AUTH_SECRET',
      example: 'replace-me',
      required: true,
      ownerCapabilityId: 'env',
    };

    expect(file.path).toBe('src/middleware.ts');
    expect(dependency.ownerCapabilityId).toBe('auth');
    expect(script.command).toBe('next dev');
    expect(envVar.required).toBe(true);
  });

  test('createEmptyProjectModel initializes all MVP collections', () => {
    const model = createEmptyProjectModel('my-app', '/projects/my-app');

    expect(model).toEqual({
      name: 'my-app',
      version: '0.1.0',
      rootPath: '/projects/my-app',
      capabilities: [],
      files: [],
      dependencies: [],
      scripts: [],
      envVars: [],
      ownership: createEmptyOwnershipMetadata(),
    });
  });
});

describe('project model operations', () => {
  test('upsert helpers maintain deterministic ordering', () => {
    let model = createEmptyProjectModel('my-app', '/projects/my-app');

    model = upsertProjectFile(model, { path: 'b.ts', exists: true });
    model = upsertProjectFile(model, { path: 'a.ts', exists: false });
    model = upsertProjectDependency(model, {
      name: 'zod',
      version: '^3.0.0',
      ownerCapabilityId: 'auth',
    });
    model = upsertProjectDependency(model, {
      name: 'next-auth',
      version: '^5.0.0',
      ownerCapabilityId: 'auth',
    });
    model = upsertProjectScript(model, {
      name: 'build',
      command: 'next build',
      ownerCapabilityId: 'core',
    });
    model = upsertProjectEnvVar(model, {
      name: 'DATABASE_URL',
      example: 'postgres://localhost',
      ownerCapabilityId: 'env',
    });

    expect(model.files.map((file) => file.path)).toEqual(['a.ts', 'b.ts']);
    expect(model.dependencies.map((dep) => dep.name)).toEqual(['next-auth', 'zod']);
    expect(model.scripts.map((script) => script.name)).toEqual(['build']);
    expect(model.envVars.map((envVar) => envVar.name)).toEqual(['DATABASE_URL']);
    expect(model.ownership.dependencies).toEqual([
      { name: 'next-auth', ownerCapabilityId: 'auth' },
      { name: 'zod', ownerCapabilityId: 'auth' },
    ]);
  });

  test('registerFileOwnership updates ownership metadata', () => {
    const model = registerFileOwnership(
      createEmptyProjectModel('my-app', '/projects/my-app'),
      'middleware.ts',
      'auth'
    );

    expect(model.ownership.files).toEqual([
      { filePath: 'middleware.ts', ownerCapabilityId: 'auth' },
    ]);
  });

  test('ownershipFromProjectModel aggregates entity ownership', () => {
    let model: KilnProjectModel = createEmptyProjectModel('my-app', '/projects/my-app');
    model = registerFileOwnership(model, 'middleware.ts', 'auth');
    model = upsertProjectDependency(model, {
      name: 'next-auth',
      version: '^5.0.0',
      ownerCapabilityId: 'auth',
    });
    model = upsertProjectScript(model, {
      name: 'dev',
      command: 'next dev',
      ownerCapabilityId: 'core',
    });
    model = upsertProjectEnvVar(model, {
      name: 'AUTH_SECRET',
      example: 'replace-me',
      ownerCapabilityId: 'env',
    });

    const ownership = ownershipFromProjectModel(model);

    expect(ownership).toEqual({
      files: [{ filePath: 'middleware.ts', ownerCapabilityId: 'auth' }],
      dependencies: [{ name: 'next-auth', ownerCapabilityId: 'auth' }],
      scripts: [{ name: 'dev', ownerCapabilityId: 'core' }],
      envVars: [{ name: 'AUTH_SECRET', ownerCapabilityId: 'env' }],
    });
  });
});

describe('ownership metadata serialization', () => {
  test('serializeOwnershipMetadata produces deterministic JSON', () => {
    const metadata: OwnershipMetadata = {
      files: [{ filePath: 'b.ts', ownerCapabilityId: 'beta' }],
      dependencies: [{ name: 'zod', ownerCapabilityId: 'auth' }],
      scripts: [{ name: 'build', ownerCapabilityId: 'core' }],
      envVars: [{ name: 'AUTH_SECRET', ownerCapabilityId: 'env' }],
    };

    const output = serializeOwnershipMetadata(metadata);
    const parsed = JSON.parse(output);

    expect(parsed.version).toBe(1);
    expect(parsed.ownership.files[0].filePath).toBe('b.ts');
    expect(parsed.ownership.dependencies[0].name).toBe('zod');
  });

  test('ownership metadata round-trips through parse and serialize', () => {
    const rawJSON = `{
  "version": 1,
  "ownership": {
    "files": [
      {
        "filePath": "middleware.ts",
        "ownerCapabilityId": "auth"
      }
    ],
    "dependencies": [
      {
        "name": "next-auth",
        "ownerCapabilityId": "auth"
      }
    ],
    "scripts": [
      {
        "name": "dev",
        "ownerCapabilityId": "core"
      }
    ],
    "envVars": [
      {
        "name": "AUTH_SECRET",
        "ownerCapabilityId": "env"
      }
    ]
  }
}
`;

    const parsed = parseOwnershipMetadata(rawJSON);
    const regenerated = serializeOwnershipMetadata(parsed);

    expect(regenerated).toBe(rawJSON);
  });

  test('parseOwnershipMetadata throws on invalid content', () => {
    expect(() => parseOwnershipMetadata('{}')).toThrow(
      'Invalid ownership metadata format: missing required top-level fields'
    );
  });
});
