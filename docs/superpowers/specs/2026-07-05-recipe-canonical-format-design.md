# Recipe Canonical Format — Design Spec

Date: 2026-07-05
Status: Approved (pending spec review)

## Problem

Two user-reported bugs, both traced to inconsistent recipe storage:

1. **Description edits are always dropped.** Editing a recipe's description in the
   editor never persists to what the user sees.
2. **Steps render twice.** The Rajma recipe shows steps 1–13, then 1–13 again on
   its detail page (ingredients double too).

### Root causes (confirmed with live evidence)

- **Bug A (description dropped):** POST (`api/recipes.ts`) writes `description`
  only as a naked first paragraph of the markdown body — no `#` heading, and no
  `description:` key in frontmatter. On read, `parseRecipe` (`recipeParser.js`)
  gates body-description extraction behind finding a `#` heading (`foundTitle`),
  which editor-saved files never contain. So it always falls through to the
  generic fallback `"A delicious recipe for {title}."`. Verified: the running
  API returns that fallback for Rajma despite a real description in the file body.

- **Bug B (double steps):** POST writes steps/ingredients into **both** the YAML
  frontmatter arrays **and** `## Instructions` / `## Ingredients` body sections.
  The detail page (`[...slug].astro`) renders the full body (already containing
  the sections) and then **appends a second** synthesized section from
  `frontmatter.steps`. Verified: step-1 phrase appears exactly 2× in the rendered
  HTML.

Both bugs share one architectural root: data is duplicated/misplaced between
frontmatter and body, and there is no single reader/writer — extraction logic is
scattered across `parseRecipe`, the GET handler's inline parser, and the detail
page's synthesis block.

### Existing data (4 files, 3 legacy shapes)

- `Desi-Italian-Creamy-Mushroom-Bagel.md` — frontmatter arrays only, empty body.
- `rajma-ranveer-brar-style.md`, `sabudana-khicadi.md` — frontmatter arrays **and**
  `##`-heading body sections (the duplicated ones).
- `shahi-kaju-paneer-gravy.md` — legacy: frontmatter `description`, `#`-heading
  (single-hash) body sections, no frontmatter arrays.

Empty directories `rajma-ranveer-brar-style/` and `sabudana-khicadi/` are litter
left by POST's unconditional `mkdir`.

## Decision

- **Body/markdown is the single source of truth.** Frontmatter never holds
  `description`, `ingredients`, or `steps`.
- **Migrate the 4 existing files once** into the canonical format.
- **Remove redundancy:** one reader (`extractRecipe`), one writer
  (`serializeRecipe`); delete the parallel extraction paths.

## Canonical format

```text
---
title, category, prepTime, cookTime, yieldVal, imageUrl, miseEnPlace
---
<description — plain text, may be multiple paragraphs>

## Ingredients
- **<proportion>** <item>          # proportion optional → "- <item>"

## Instructions
1. <step>
```

## Architecture

### New module: `src/utils/recipeFormat.js` (pure, unit-testable)

- **`extractRecipe(rawContent)` → structured object**
  `{ title, category, description, prepTime, cookTime, yieldVal, imageUrl,
  miseEnPlace, ingredients[], steps[] }`.
  Tolerant reader that normalizes all legacy shapes:
  - ingredients/steps from frontmatter arrays if present, else from body
    `##`- or `#`-heading sections;
  - ingredient line `- **prop** item` or plain `- item`;
  - steps from `N.` numbered or `-`/`*` bulleted lines;
  - description from frontmatter `description`, else the leading body block
    before the first section heading (stripping a leading `# Title` line if any),
    else the `"A delicious recipe for {title}."` fallback.

- **`serializeRecipe(structured)` → canonical markdown string**
  Emits the canonical format. Frontmatter excludes description/ingredients/steps.
  Ingredient with empty proportion → `- item` (no empty bold). Used by both POST
  and the migration so saved and migrated files are shape-identical.

### Consumers (redundancy removed)

- `recipeParser.js` — `parseRecipe(filePath, raw)` becomes a thin wrapper that
  delegates to `extractRecipe` (keeps existing signature/return shape for
  `index.astro` and the detail page). Its duplicate description/metadata parsing
  is deleted.
- `api/recipes.ts`:
  - **GET (single):** use `extractRecipe`; delete the inline body-parser block.
    Fixes editor-load for shahi-kaju's `#`-heading sections as a bonus.
  - **POST:** build file content via `serializeRecipe`; frontmatter arrays gone;
    description persisted in body. Only `mkdir` the image dir when an image is
    actually written (stops empty-dir litter). Continues writing flat `slug.md`.
- `recipes/[...slug].astro`:
  - Delete the frontmatter-append synthesis (the second `## Instructions` /
    `## Ingredients`). Render Ingredients/Instructions from the body only
    (post-migration every file has body sections). Description comes from
    `parseRecipe`/`extractRecipe`, now correct.

### Migration: `scripts/migrate-recipes.mjs`

For each `data/recipes/*.md`: `serializeRecipe(extractRecipe(raw))`, write back.
Idempotent (re-run = no-op). Delete empty dirs `rajma-ranveer-brar-style/` and
`sabudana-khicadi/`; leave `desi-italian-creamy-mushroom-bagel/miseenplace/`.

## Data flow

Save: editor → POST → `serializeRecipe` → `data/recipes/<slug>.md`.
Read: file → `extractRecipe` → GET (editor) / `parseRecipe` (index, detail).
Migration: file → `extractRecipe` → `serializeRecipe` → file (normalized).

## Error handling

- `extractRecipe` never throws on malformed input; missing fields default
  (empty arrays, fallback description, `N/A` times) exactly as today.
- POST unchanged re: slug sanitation (`sanitiseSlug`) and 400 on invalid slug.
- Migration is idempotent and operates only on `data/recipes/*.md`.

## Testing (TDD — tests first)

- `src/utils/recipeFormat.test.js` (new):
  - `extractRecipe` reads each of the 4 legacy shapes into correct structured data.
  - `serializeRecipe` output: no frontmatter `description`/`ingredients`/`steps`;
    exactly one `## Ingredients` and one `## Instructions`.
  - Round-trip: for a structured recipe with a non-empty description,
    `extractRecipe(serializeRecipe(x))` deep-equals `x`. (Empty-description case:
    extract returns the `"A delicious recipe for {title}."` fallback by design, so
    round-trip equality is asserted only for the non-empty case.)
  - **Bug A regression:** a canonical file's description round-trips (not the
    fallback).
  - **Bug B regression:** serializing a "both" recipe yields exactly one
    Instructions section; extracting a legacy "both" file yields 13 (not 26) steps.
- `src/utils/recipeParser.test.js` (update): description extraction from a body
  with no `#` heading; parseRecipe still returns the documented shape.

## Deployment

Running container `svens-cookbook-app` is the **prod** built image (source not
volume-mounted; only `./data`, `./backups`). Procedure after green tests:

1. Run migration against `./data` (mounted, so live for reads immediately).
2. `docker compose build && docker compose up -d` to ship the source fixes.

## Out of scope (YAGNI)

- Ingredient-based search (placeholder says "or ingredients" but the filter only
  matches title+description — pre-existing, unchanged).
- Image-serving mechanism for `/images/<slug>/…` (unrelated to these bugs).
- Path convention change (`.md` stays flat; only empty-dir litter is cleaned).

## Commits

TDD-driven, small, one concern each. **No Claude authorship and no
`Co-Authored-By` trailer** on any commit (project rule).
