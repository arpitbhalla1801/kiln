import type { AuthFilePaths } from './types.js';
import { resolveProvider } from './providers.js';

/** Options for wiring the Auth.js Prisma adapter into the generated auth config. */
export interface AuthAdapterOptions {
  /** Relative import specifier (no extension) for the db capability's client, e.g. "./lib/db". */
  dbClientImportPath: string;
}

export function createAuthConfigContent(
  providerIds: string[] = [],
  adapter?: AuthAdapterOptions
): string {
  const providers = providerIds.map(resolveProvider);

  const providerImports = providers
    .map((provider) => `import ${provider.importName} from "${provider.importSpecifier}";`)
    .join('\n');

  // Kept empty (not '\n') when there's no adapter, so the no-adapter output stays
  // byte-identical to before -- every "was this hand-edited" check compares against it.
  const adapterImportLines = adapter
    ? `\nimport { PrismaAdapter } from "@auth/prisma-adapter";\nimport { db } from "${adapter.dbClientImportPath}";`
    : '';

  const importBlock = providerImports
    ? `import NextAuth from "next-auth";\n${providerImports}${adapterImportLines}`
    : `import NextAuth from "next-auth";${adapterImportLines}`;

  const providersList = providers.map((provider) => `    ${provider.factoryExpression},`).join('\n');
  const providersArray = providersList ? `[\n${providersList}\n  ]` : '[]';

  // This comment lands in the generated file itself, for whoever reads auth.ts next.
  const adapterField = adapter
    ? '  // Session strategy defaults to "database" because an adapter is set (it would\n' +
      '  // be "jwt" without one): sessions live in the adapter\'s Session model instead\n' +
      '  // of being encoded into a signed cookie. Override with `session: { strategy }`.\n' +
      '  adapter: PrismaAdapter(db),\n'
    : '';

  return `${importBlock}

export const { handlers, auth, signIn, signOut } = NextAuth({
${adapterField}  providers: ${providersArray},
});
`;
}

export function createMiddlewareContent(authImportPath: string): string {
  return `import { auth } from "${authImportPath}";

export default auth(() => undefined);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
`;
}

export function createRouteHandlerContent(): string {
  return `import { handlers } from "../../../../auth";

export const { GET, POST } = handlers;
`;
}

export interface ProviderMergePatch {
  importSearch: string;
  importReplace: string;
  providersSearch: string;
  providersReplace: string;
}

/**
 * Anchors for merging new providers into a hand-edited auth.ts via file-patch.
 * Both anchors are constant strings that any kiln-generated (or reasonably
 * conventional) auth.ts contains, so repeated merges across multiple `kiln add
 * auth --provider x` runs keep finding the same anchor.
 */
export function buildProviderMergePatch(newProviderIds: string[]): ProviderMergePatch {
  const providers = newProviderIds.map(resolveProvider);

  const newImports = providers
    .map((provider) => `import ${provider.importName} from "${provider.importSpecifier}";`)
    .join('\n');

  const newEntries = providers.map((provider) => `    ${provider.factoryExpression},`).join('\n');

  return {
    importSearch: 'import NextAuth from "next-auth";',
    importReplace: `import NextAuth from "next-auth";\n${newImports}`,
    providersSearch: 'providers: [',
    providersReplace: `providers: [\n${newEntries}`,
  };
}

export function resolveAuthImportPath(paths: AuthFilePaths): string {
  if (paths.authFile.startsWith('src/')) {
    return './auth';
  }

  return paths.middlewareFile.startsWith('src/') ? '../auth' : './auth';
}
