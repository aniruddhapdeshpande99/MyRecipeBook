# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Quick Start

```bash
# Production (what Sven actually uses)
docker compose build && docker compose up -d

# Development with hot-reload (runs inside Docker — no local npm needed)
docker compose up dev

# Run tests inside Docker (always Linux, always consistent)
docker compose run --rm dev npm run test:run
```

## Architecture: Why Docker is the Development Environment

This project uses a **multi-stage Docker base image** to eliminate cross-platform
native binary conflicts between Windows (PowerShell) and Linux (WSL):

```
Dockerfile stages:
  base  → node:22-slim + npm install  (Linux binaries, always consistent)
  dev   → base + dev server entrypoint
  prod  → base + astro build + runtime image
```

**Key principle:** `npm install` runs *inside the container*, not on the host.
Node.js native bindings (rollup, esbuild) are resolved for Linux once, in the
base image. The host machine only needs Docker — it never touches `node_modules`.

## Docker Commands (works from PowerShell or WSL)

```bash
# Build and run production image
docker compose build
docker compose up -d
docker compose down
docker compose logs -f

# Development with hot-reload (source is volume-mounted from host)
docker compose up dev          # starts hot-reload dev server on :4321
docker compose down dev

# Run commands in the dev container (tests, builds, etc.)
docker compose run --rm dev npm run test:run
docker compose run --rm dev npm run build
docker compose run --rm dev npm run test:ci
```

## Local npm commands (optional — for IDE TypeScript support only)

If you need IDE autocomplete/TypeScript in your editor, install locally:
```bash
# PowerShell
npm install

# WSL
npm install
```
Both work — the Linux-only devDependencies were removed so `npm install` no
longer fails on Windows. The local `node_modules` are for tooling only;
the app always runs from inside Docker.

## npm Scripts

All scripts are cross-platform (no Linux-only env vars):

| Script | Description |
|---|---|
| `npm run dev` | Astro dev server (hot-reload) |
| `npm run build` | Type-check + production build |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest one-shot (CI / pre-commit) |
| `npm run test:ci` | Vitest one-shot verbose |

## Architecture

**Astro 6 SSR app** with Node.js adapter (`standalone` mode). Every page
renders server-side — no static pre-built routes.

### Data layer
Recipes are **markdown files** in `data/recipes/`. `gray-matter` parses YAML
frontmatter; `marked` converts body to HTML. Folder structure = category:
- `data/recipes/recipe.md` → `category: General`
- `data/recipes/Mains/recipe.md` → `category: Mains`

`src/utils/recipeParser.js` — `parseRecipe(filePath, rawContent)` export.
`src/utils/slugUtils.ts` — `sanitiseSlug(raw)` — strips everything except
`[a-zA-Z0-9_-]` and lowercases. **Use this everywhere slug params are handled.**

### Pages
- `index.astro` — walks `data/recipes/` recursively, groups by category, searchable + filterable grid.
- `recipes/[...slug].astro` — loads recipe file using `sanitiseSlug` (no traversal), two-column layout with cooking mode + Prev/Next nav.
- `editor.astro` — mounts React editor. `?slug=<slug>` pre-loads a recipe for editing.
- `api/recipes.ts` — GET (single recipe JSON) + POST (write to disk). Both use `sanitiseSlug`.
- `api/download.ts` — returns recipe as `.md` attachment.
- `api/suggest.ts` — appends suggestion to `data/suggestions.log` (stub — no email).

### Components
- `RecipeEditor.jsx` — React form. Uses `uuid()` helper (with iOS Safari < 15.4 fallback).
- `Footer.astro`, `AboutSection.astro`, `ContactSection.astro` — static layout.
- `ContactForm.jsx` — posts to `/api/suggest`.

### Styling
`src/styles/global.css` — Tailwind v4 `@theme` defines the design token set:
- Sage green `#3E5643` (primary / header / badges)
- Cream `#F4F3EF` (backgrounds)
- Terracotta `#8C3B1A` (active state accents)
- Fonts: Lora (serif headings) + Inter (sans body) from Google Fonts
- Dark mode via `@media (prefers-color-scheme: dark)`

### Key Constraints

- **SSR only** — `import.meta.glob` doesn't work; all file I/O uses `node:fs` at request time.
- **Slug security** — always use `sanitiseSlug` from `slugUtils`. Never use raw URL params as file paths.
- **No database** — persistence is the filesystem, volume-mounted at `./data`.
- **Tailwind v4** — configured as a Vite plugin (`@tailwindcss/vite`), not PostCSS. Use `@theme` for design tokens.
- **Cross-platform scripts** — no Linux-only env vars. Docker handles native binaries.
