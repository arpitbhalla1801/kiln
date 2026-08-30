import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kiln Next.js Example',
  description: 'Example Next.js app configured with kiln env and auth capabilities',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
