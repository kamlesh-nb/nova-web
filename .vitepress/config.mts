import { defineConfig } from 'vitepress'
import novaGrammar from './grammars/nova.tmLanguage.json'

export default defineConfig({
  markdown: {
    // Load the real Nova TextMate grammar (from the VSCode extension) so ```nova and ```nsx
    // fences in the guide are syntax-highlighted instead of falling back to plain text.
    languages: [
      { ...(novaGrammar as any), name: 'nova', scopeName: 'source.nova', aliases: ['nsx'] },
    ],
  },
  title: 'Nova',
  // Project page at https://kamlesh-nb.github.io/nova-web/ . Change to '/' for a user page or a
  // custom domain. The home component uses withBase(), so internal links follow this automatically.
  base: '/nova-web/',
  description:
    'Nova is a statically-typed language built for hypermedia web applications, with an async thread-per-core runtime, an embedded B+Tree database (NovaDB), and a native orchestrator. One language, one toolchain, one binary.',
  cleanUrls: true,
  lastUpdated: true,
  // The guide links out to code paths (examples/, ../STABILITY.md) that do not exist in the site.
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', href: '/nova_logo.png' }],
    ['meta', { name: 'theme-color', content: '#1f6feb' }],
    ['meta', { property: 'og:title', content: 'Nova, a language for hypermedia services' }],
    ['meta', {
      property: 'og:description',
      content: 'A statically-typed language built for hypermedia web applications, with a thread-per-core runtime, an embedded B+Tree database, and a native orchestrator.'
    }],
  ],
  themeConfig: {
    logo: '/nova_logo.png',
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Language', link: '/guide/01-getting-started' },
      { text: 'Web', link: '/guide/17-web' },
      { text: 'NovaDB', link: '/guide/18-data-access' },
      { text: 'Orchestrator', link: '/guide/23-deploying-with-the-orchestrator' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Overview',
          items: [{ text: 'The guide', link: '/guide/' }],
        },
        {
          text: 'Language',
          collapsed: false,
          items: [
            { text: '1. Getting started', link: '/guide/01-getting-started' },
            { text: '2. Values and types', link: '/guide/02-values-and-types' },
            { text: '3. Strings', link: '/guide/03-strings' },
            { text: '4. Control flow', link: '/guide/04-control-flow' },
            { text: '5. Functions and closures', link: '/guide/05-functions-and-closures' },
            { text: '6. Collections', link: '/guide/06-collections' },
            { text: '7. Structs', link: '/guide/07-structs' },
            { text: '8. Enums', link: '/guide/08-enums' },
            { text: '9. Traits', link: '/guide/09-traits' },
            { text: '10. Optionals', link: '/guide/10-optionals' },
            { text: '11. Error handling', link: '/guide/11-error-handling' },
            { text: '12. Decimal', link: '/guide/12-decimal' },
            { text: '13. Ownership', link: '/guide/13-ownership' },
            { text: '14. Modules', link: '/guide/14-modules' },
            { text: '15. Concurrency', link: '/guide/15-concurrency' },
            { text: '16. Serialization', link: '/guide/16-serialization' },
          ],
        },
        {
          text: 'Web and data',
          collapsed: false,
          items: [
            { text: '17. Web applications', link: '/guide/17-web' },
            { text: '18. Data access and the ORM', link: '/guide/18-data-access' },
            { text: '19. Package management', link: '/guide/19-package-management' },
            { text: '20. Database drivers', link: '/guide/20-database-drivers' },
          ],
        },
        {
          text: 'Platform',
          collapsed: false,
          items: [
            { text: '21. Architecture', link: '/guide/21-architecture' },
            { text: '22. Building and distributing', link: '/guide/22-building-and-distribution' },
            { text: '23. Deploying with the orchestrator', link: '/guide/23-deploying-with-the-orchestrator' },
            { text: '24. Artifact delivery', link: '/guide/24-blob-store' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/kamlesh-nb/nova' }],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
  },
})
