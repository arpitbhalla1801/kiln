export interface AuthProviderDescriptor {
  id: string;
  importName: string;
  importSpecifier: string;
  factoryExpression: string;
  envVars: string[];
}

export const AUTH_PROVIDERS: Record<string, AuthProviderDescriptor> = {
  github: {
    id: 'github',
    importName: 'GitHub',
    importSpecifier: 'next-auth/providers/github',
    factoryExpression: 'GitHub',
    envVars: ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'],
  },
  google: {
    id: 'google',
    importName: 'Google',
    importSpecifier: 'next-auth/providers/google',
    factoryExpression: 'Google',
    envVars: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'],
  },
  credentials: {
    id: 'credentials',
    importName: 'Credentials',
    importSpecifier: 'next-auth/providers/credentials',
    factoryExpression: 'Credentials({ credentials: {}, authorize: () => null })',
    envVars: [],
  },
};

export function resolveProvider(id: string): AuthProviderDescriptor {
  const provider = AUTH_PROVIDERS[id];
  if (!provider) {
    const validIds = Object.keys(AUTH_PROVIDERS).join(', ');
    throw new Error(`Unknown auth provider '${id}'. Valid providers: ${validIds}`);
  }

  return provider;
}
