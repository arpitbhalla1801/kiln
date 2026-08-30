import type { AuthFilePaths } from './types.js';

export function createAuthConfigContent(): string {
  return `import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
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

export function resolveAuthImportPath(paths: AuthFilePaths): string {
  if (paths.authFile.startsWith('src/')) {
    return './auth';
  }

  return paths.middlewareFile.startsWith('src/') ? '../auth' : './auth';
}
