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

export function resolveAuthImportPath(paths: AuthFilePaths): string {
  if (paths.authFile.startsWith('src/')) {
    return './auth';
  }

  return paths.middlewareFile.startsWith('src/') ? '../auth' : './auth';
}
