# Nova promote site

The Nova marketing home plus the full language guide, built with
[VitePress](https://vitepress.dev).

```bash
npm install      # once
npm run dev      # local dev server with hot reload
npm run build    # static build into .vitepress/dist
npm run preview  # serve the built site
```

## Layout

- `index.md` + `.vitepress/theme/Home.vue` — the custom home ("stack ledger" concept,
  no traditional hero). Styles live in `.vitepress/theme/custom.css`.
- `guide/` — the language guide, chapters 1 to 24 (copied from `lang/docs/guide`).
- `.vitepress/config.mts` — nav, the guide sidebar, and the Nova syntax grammar.
- `.vitepress/grammars/nova.tmLanguage.json` — the Nova TextMate grammar (from the
  VSCode extension) so ` ```nova ` and ` ```nsx ` code blocks are highlighted.
- `public/` — logos and illustrations served at the site root.
- `_legacy/` — the previous static site, kept for reference.

The guide markdowns here are a COPY; the canonical source stays in `lang/docs/guide`.
