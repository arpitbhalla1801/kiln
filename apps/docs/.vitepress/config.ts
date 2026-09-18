import { defineConfig } from "vitepress";

export default defineConfig({
  title: "kiln",
  description: "CLI to scaffold auth, env, and plugin capabilities into your app",
  base: "/kiln/",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Capabilities", link: "/capabilities/overview" },
      { text: "Reference", link: "/reference/cli" },
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
