import type { AuthFilePaths } from './types.js';
import { resolveProvider } from './providers.js';

export function createAuthConfigContent(providerIds: string[] = []): string {
  const providers = providerIds.map(resolveProvider);

  const providerImports = providers
    .map((provider) => `import ${provider.importName} from "${provider.importSpecifier}";`)
    .join('\n');

  const importBlock = providerImports
    ? `import NextAuth from "next-auth";\n${providerImports}`
    : 'import NextAuth from "next-auth";';

  const providersList = providers.map((provider) => `    ${provider.factoryExpression},`).join('\n');
  const providersArray = providersList ? `[\n${providersList}\n  ]` : '[]';

  return `${importBlock}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: ${providersArray},
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
