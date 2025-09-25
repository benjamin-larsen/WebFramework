import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Noctes.jsx API",
  description: "Docuemntation of Noctes.jsx",
  base: '/Noctes.jsx/',
  outDir: '../docs',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: "Introduction", link: '/introduction' },
          { text: 'Entrypoint (src/main.js)', link: '/entry' },
          { text: 'JSX Files (Components)', link: '/jsx-files' }
        ]
      },
      {
        text: "APIs",
        items: [
          { text: "App", link: '/api-app' },
          { text: "Components", link: '/api-component' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/benjamin-larsen/Noctes.jsx' }
    ]
  }
})
