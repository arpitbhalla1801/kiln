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
    // Demo-only check against env-configured credentials, not a user database --
    // swap authorize() for a real lookup before shipping this to production.
    factoryExpression:
      'Credentials({ credentials: { email: {}, password: {} }, authorize: async (creds) => (creds?.email === process.env.AUTH_DEMO_EMAIL && creds?.password === process.env.AUTH_DEMO_PASSWORD) ? { id: "1", email: String(creds.email) } : null })',
    envVars: ['AUTH_DEMO_EMAIL', 'AUTH_DEMO_PASSWORD'],
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
