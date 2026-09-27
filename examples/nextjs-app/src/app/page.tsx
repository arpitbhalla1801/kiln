import { auth, signIn, signOut } from '../auth';

export default async function Home() {
  const session = await auth();

  return (
    <main>
      <h1>Kiln Next.js Example</h1>
      <p>
        This app demonstrates a kiln-managed Next.js project with env and auth capabilities
        applied.
      </p>
      <ul>
        <li>TypeScript configured</li>
        <li>App Router under <code>src/app</code></li>
        <li>Auth.js middleware in <code>src/middleware.ts</code></li>
        <li>Ownership tracked in <code>.kiln/ownership.json</code></li>
      </ul>
      {session?.user ? (
        <form
          action={async () => {
            'use server';
            await signOut();
          }}
        >
          <p>Signed in as {session.user.email}</p>
          <button type="submit">Sign out</button>
        </form>
      ) : (
        <form
          action={async (formData: FormData) => {
            'use server';
            await signIn('credentials', {
              email: formData.get('email'),
              password: formData.get('password'),
              redirectTo: '/',
            });
          }}
        >
          <p>
            Not signed in. Demo credentials live in <code>.env.local</code> (
            <code>AUTH_DEMO_EMAIL</code> / <code>AUTH_DEMO_PASSWORD</code>).
          </p>
          <input name="email" type="email" placeholder="email" required />
          <input name="password" type="password" placeholder="password" required />
          <button type="submit">Sign in</button>
        </form>
      )}
    </main>
  );
}
