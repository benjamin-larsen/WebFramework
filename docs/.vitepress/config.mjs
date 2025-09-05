import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "WebFramework API",
  description: "Docuemntation of WebFramework",
  base: '/WebFramework/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'First App', link: '/example' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: "Introduction", link: '/introduction' },
          { text: 'How to build your first app', link: '/example' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
