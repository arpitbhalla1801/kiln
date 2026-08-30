export default function Home() {
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
    </main>
  );
}
