# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (SSR, hot-reload)
npm run build      # Type-check + production build (astro check && astro build)
npm run preview    # Preview production build
npm test           # Run Vitest unit tests
```

Run a single test file:
```bash
npx vitest src/utils/recipeParser.test.js
```

## Architecture

**Astro 6 SSR app** with Node.js adapter (`standalone` mode). Every page renders server-side — there are no static pre-built routes.

### Data layer
Recipes are **markdown files** stored in `data/recipes/`. `gray-matter` parses YAML frontmatter; `marked` converts body to HTML. Folder structure is the category system — files directly in `data/recipes/` get `category: General`; files in `data/recipes/Mains/` get `category: Mains`.

`src/utils/recipeParser.js` — single `parseRecipe(filePath, rawContent)` export. It normalises paths cross-platform, derives slug from filename, extracts title/description/times from frontmatter or inline markers (supports several legacy formats).

### Pages
- `src/pages/index.astro` — recursively walks `data/recipes/` via `fs.readdir`, groups by category, renders searchable grid.
- `src/pages/recipes/[...slug].astro` — loads single recipe file, converts to HTML, then a client `<script>` re-parses the raw HTML DOM to build a structured two-column layout (ingredients left, instructions right) + cooking mode.
- `src/pages/editor.astro` — thin shell that mounts the React editor.
- `src/pages/api/recipes.ts` — GET (load single recipe JSON for editor) and POST (write markdown file to disk, filename-sanitised).

### Components
`src/components/RecipeEditor.jsx` — React form, self-contained with local state. Calls `/api/recipes` GET on mount when `existingSlug` prop is set, POST on submit. Redirects home on success.

### Styling
`src/styles/global.css` — Tailwind v4 `@theme` block defines the full design token set (sage green `#3E5643`, cream `#F4F3EF`, terracotta `#8C3B1A`). All component styles use CSS custom properties from this theme. Dark mode via `@media (prefers-color-scheme: dark)`. Fonts: Lora (serif headings) + Inter (sans body), loaded from Google Fonts.

### Images
Recipe hero images live at `public/images/{slug}.jpg`. The slug page checks for existence with `fs.existsSync` at request time; if missing, no image is rendered. No upload mechanism — images are placed manually.

## Key constraints

- **SSR only** — `import.meta.glob` static patterns do not work; all file I/O must use `node:fs` at request time.
- **No database** — all persistence is the filesystem. The `archiver` and `node-cron` packages are installed but not wired up yet.
- **Slug derivation** — slugs come from the markdown filename (lowercased, `.md` stripped). The editor POST endpoint sanitises filenames but does not support subdirectory creation; all new recipes land flat in `data/recipes/`.
- **Tailwind v4** — configured as a Vite plugin (`@tailwindcss/vite`), not a PostCSS plugin. Use `@theme` for design tokens, not `tailwind.config.js`.
