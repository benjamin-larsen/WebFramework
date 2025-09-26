import { defineConfig } from 'vitepress'
import { groupIconMdPlugin, groupIconVitePlugin, localIconLoader } from 'vitepress-plugin-group-icons'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Noctes.jsx API",
  description: "Docuemntation of Noctes.jsx",
  base: '/Noctes.jsx/',
  outDir: '../docs',
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin)
    }
  },
  vite: {
    plugins: [
      groupIconVitePlugin({
        customIcon: {
          ".jsx": localIconLoader(import.meta.url, "../assets/jsx.svg")
        }
      })
    ]
  },
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
          { text: 'JSX Files (Components)', link: '/jsx-files' },
          { text: 'Example App', link: '/example' }
        ]
      },
      {
        text: "APIs",
        items: [
          { text: "App", link: '/api-app' },
          { text: "Components", link: '/api-component' },
          { text: "JSX", link: '/api-jsx' },
          { text: "Reactivity", link: '/api-reactivity' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/benjamin-larsen/Noctes.jsx' }
    ]
  }
})
