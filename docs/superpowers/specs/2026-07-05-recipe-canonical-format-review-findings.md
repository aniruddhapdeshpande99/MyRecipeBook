# Recipe Canonical Format — Code Review Findings (for follow-up brainstorming)

Date: 2026-07-05
Source: `/code-review max` (2 independent finder passes + inline analysis) on branch `fix/recipe-canonical-format`.
Status: The two REPORTED bugs (dropped description edits, doubled steps) are FIXED and verified live. The findings below are ADDITIONAL faults surfaced by the review, to be addressed in a later brainstorming.

## Theme

The chosen "body-authoritative" format is, as implemented, actually
**structured-field-authoritative**: `serializeRecipe` rebuilds the Markdown body
from only `description` (first line) + `ingredients` + `steps`. So the
extract→serialize round-trip (run on every editor save AND by the migration) is
**lossy** — any body content that isn't one of those three fields is discarded,
and description punctuation is mangled.

## LIVE findings (affect the current 4 recipes / next edit)

### A. Lossy round-trip drops body content beyond description/ingredients/steps  — HIGH
`extractRecipe` captures description as only the first qualifying body line, and
`parseBodySections` only captures lines inside `## Ingredients`/`## Instructions`.
`serializeRecipe` has no slot for anything else. So second paragraphs,
`## Notes`/`## Tips`/`## Storage` sections, prose after the steps, blockquotes,
and `###` ingredient subgroup headings (a feature the detail-page client JS
explicitly renders) are **silently dropped** on every save and on migration.
- **Confirmed:** the migration already deleted rajma's second paragraph
  "Bonus - Spiced Lemon Onion Salad" (present in `data/recipes.bak-20260705211848/`,
  gone from the live file).
- Files: `src/utils/recipeFormat.js` (`extractRecipe`, `parseBodySections`,
  `serializeRecipe`), `scripts/migrate-recipes.mjs`.

### B. Description strips literal `*` and `_` — MEDIUM-HIGH
`extractDescription` does `desc.replace(/\*\*|\*|_/g, '')`, deleting every literal
asterisk/underscore, not just emphasis delimiters. Because description now lives
only in the body (never frontmatter), it is forced through this lossy parser on
every read. E.g. `"Mom's *Famous* Chili_Verde"` → `"Mom's Famous ChiliVerde"`
(underscore deleted, words fused), permanently and idempotently.
- File: `src/utils/recipeFormat.js:~142`.

## LATENT findings (no current trigger — no subfolder recipes, all 4 migrated & categorized)

### C. Detail page renders raw frontmatter / blank for a non-canonical file — HIGH-if-triggered
With the frontmatter→body synthesis removed, a frontmatter-array-only file (empty
body) makes `mdBody.trim()===''` → `contentForRender || rawContent` falls back to
the **raw file text** (YAML and all), which `marked` renders literally; the
client column-builder finds no headings and shows a blank recipe. Safe only
because every current file was migrated to have body sections.
- File: `src/pages/recipes/[...slug].astro:~36-39`.

### D. Migration misses category subfolders — MEDIUM
`migrate-recipes.mjs` uses a single non-recursive `fs.readdir` and only migrates
top-level `*.md`. `data/recipes/<Category>/recipe.md` (documented in CLAUDE.md,
handled by the recursive GET `walk`) would be skipped, leaving it exposed to
finding C. No subfolder recipes exist today.
- File: `scripts/migrate-recipes.mjs:11-14`.

### E. Lost `## info` metadata fallback (legacy "Jeff" format) — LOW-MEDIUM
`extractRecipe` dropped the old `parseRecipe` third-tier fallback that parsed
prepTime/yield from a `## info` bullet list. A recipe with times only in `## info`
now yields empty metadata (and migration bakes the loss in). No current file uses
this shape.
- File: `src/utils/recipeFormat.js` (metadata section).

### F. `category` no longer falls back to folder/'General' in the API — MEDIUM
`extractRecipe` returns `category: data.category || ''`; the old GET merged
`parseRecipe`'s folder/'General' default. A category-less file would now load a
blank category into the editor and re-save with category dropped. All 4 current
files have explicit categories, so latent. (`parseRecipe` itself still applies the
path fallback for index/detail; only the API GET path regressed.)
- File: `src/utils/recipeFormat.js:~75`, consumed by `src/pages/api/recipes.ts`.

### G. `serializeRecipe` can emit a dangling `## Ingredients` heading — LOW
The heading is written when `ingredients.length > 0`, but each entry can be
skipped inside the loop (`if (!item && !proportion) continue`). An all-blank array
yields a heading with no list.
- File: `src/utils/recipeFormat.js:13-21`.

### H. Text-only save fails if `data/recipes/` doesn't exist — LOW
POST removed the unconditional `mkdir(recipeDir)`; a text-only save on a fresh
install where `data/recipes/` is absent would `ENOENT` on `writeFile`. The dir
always exists in this deployment.
- File: `src/pages/api/recipes.ts` (POST).

## Suggested direction for the brainstorming

Decide how "body-authoritative" should really behave. Options to weigh:
1. **Preserve the full body verbatim** — keep the user's Markdown body as-is;
   derive/patch only the structured pieces the UI needs, instead of regenerating
   the whole body from 3 fields. Eliminates A, B, and the `### ` subgroup loss.
2. **Extend the structured model** — add fields for notes, multi-paragraph
   description, and ingredient groups; preserve unknown sections.
3. Harden the edges regardless: recursive migration (D), a render fallback for
   non-canonical files (C), keep the folder/'General' category default (F),
   and stop stripping `_`/`*` from descriptions (B).
