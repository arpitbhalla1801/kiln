import { defineConfig, type HeadConfig } from "vitepress";

const siteUrl = "https://arpitbhalla1801.github.io/kiln/";

export default defineConfig({
  title: "kiln — Capability-based CLI for Bun + Next.js",
  description:
    "kiln is a capability-based CLI that scaffolds auth, env, and plugin capabilities into Bun and Next.js apps, tracking file ownership so upgrades stay safe and predictable.",
  lang: "en-US",
  base: "/kiln/",
  cleanUrls: true,
  sitemap: {
    hostname: siteUrl,
  },
  transformHead({ pageData, siteConfig }) {
    const path = pageData.relativePath
      .replace(/(^|\/)index\.md$/, "$1")
      .replace(/\.md$/, "");
    const canonicalUrl = new URL(path, siteUrl).href;
    const pageTitle = pageData.title || siteConfig.site.title;
    const pageDescription = pageData.description || siteConfig.site.description;

    const head: HeadConfig[] = [
      ["link", { rel: "canonical", href: canonicalUrl }],
      ["meta", { property: "og:url", content: canonicalUrl }],
      ["meta", { property: "og:title", content: pageTitle }],
      ["meta", { property: "og:description", content: pageDescription }],
      ["meta", { name: "twitter:title", content: pageTitle }],
      ["meta", { name: "twitter:description", content: pageDescription }],
    ];

    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
      const crumbs = [{ name: "kiln", url: siteUrl }];
      let accPath = "";
      for (const segment of segments) {
        accPath += `${segment}/`;
        const name = segment
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        crumbs.push({ name, url: new URL(accPath, siteUrl).href });
      }

      head.push([
        "script",
        { type: "application/ld+json" },
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: crumb.url,
          })),
        }),
      ]);
    }

    return head;
  },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/kiln/favicon.svg" }],
    ["link", { rel: "icon", type: "image/x-icon", href: "/kiln/favicon.ico" }],
    ["link", { rel: "apple-touch-icon", href: "/kiln/apple-touch-icon.png" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary" }],
    [
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "kiln",
        description:
          "kiln is a capability-based CLI that scaffolds auth, env, and plugin capabilities into Bun and Next.js apps, tracking file ownership so upgrades stay safe and predictable.",
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
            { text: "Db", link: "/capabilities/db" },
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
