import { defineConfig } from "vitepress";

const siteUrl = "https://arpitbhalla1801.github.io/kiln/";

export default defineConfig({
  title: "kiln — Capability-based CLI for Bun + Next.js",
  description: "CLI to scaffold auth, env, and plugin capabilities into your app",
  lang: "en-US",
  base: "/kiln/",
  cleanUrls: true,
  sitemap: {
    hostname: siteUrl,
  },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/kiln/favicon.svg" }],
    ["link", { rel: "icon", type: "image/x-icon", href: "/kiln/favicon.ico" }],
    ["link", { rel: "apple-touch-icon", href: "/kiln/apple-touch-icon.png" }],
    ["link", { rel: "canonical", href: siteUrl }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:url", content: siteUrl }],
    ["meta", { property: "og:title", content: "kiln — Capability-based CLI for Bun + Next.js" }],
    [
      "meta",
      {
        property: "og:description",
        content: "CLI to scaffold auth, env, and plugin capabilities into your app",
      },
    ],
    ["meta", { name: "twitter:card", content: "summary" }],
    ["meta", { name: "twitter:title", content: "kiln — Capability-based CLI for Bun + Next.js" }],
    [
      "meta",
      {
        name: "twitter:description",
        content: "CLI to scaffold auth, env, and plugin capabilities into your app",
      },
    ],
    [
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "kiln",
        description: "CLI to scaffold auth, env, and plugin capabilities into your app",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Cross-platform",
        url: siteUrl,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      }),
    ],
  ],
  themeConfig: {
    siteTitle: "kiln",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Capabilities", link: "/capabilities/overview" },
      { text: "Reference", link: "/reference/cli" },
      {
        // ponytail: version switcher links out to the v1.1.0 tag rather than
        // hosting a duplicate doc tree; add a real /v1/ content tree once
        // 2.0.0 ships and the two versions actually diverge in usage.
        text: "v2.x (main)",
        items: [
          { text: "v2.x (current)", link: "/" },
          {
            text: "v1.x (stable)",
            link: "https://github.com/arpitbhalla1801/kiln/blob/v1.1.0/README.md",
          },
        ],
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Commands", link: "/guide/commands" },
          ],
        },
      ],
      "/capabilities/": [
        {
          text: "Capabilities",
          items: [
            { text: "Overview", link: "/capabilities/overview" },
            { text: "Auth", link: "/capabilities/auth" },
            { text: "Env", link: "/capabilities/env" },
            { text: "Plugins", link: "/capabilities/plugins" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "CLI", link: "/reference/cli" },
            { text: "Changelog", link: "/reference/changelog" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/arpitbhalla1801/kiln" },
    ],
    search: {
      provider: "local",
    },
  },
});
