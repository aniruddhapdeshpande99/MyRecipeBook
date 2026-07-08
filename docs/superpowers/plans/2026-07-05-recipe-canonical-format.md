# Recipe Canonical Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix "description edits dropped" and "steps rendered twice" by making the Markdown body the single source of truth, via one shared reader/writer, and migrating the 4 existing recipe files.

**Architecture:** New pure module `src/utils/recipeFormat.js` exposes `extractRecipe(raw)` (tolerant reader for all legacy shapes) and `serializeRecipe(structured)` (canonical writer). `parseRecipe` becomes a thin wrapper over `extractRecipe`. The API GET/POST and detail page use these, deleting their duplicated parsing/synthesis. A one-off migration normalizes existing files.

**Tech Stack:** Astro 6 SSR, Node 22, `gray-matter`, `marked`, Vitest, Docker.

## Global Constraints

- Body/Markdown is the single source of truth. Frontmatter NEVER contains `description`, `ingredients`, or `steps`.
- Canonical body order: `<description>`, then `## Ingredients` (`- **<prop>** <item>`, or `- <item>` when no proportion), then `## Instructions` (`N. <step>`).
- All slug handling stays via `sanitiseSlug` from `src/utils/slugUtils`.
- Recipe `.md` files stay FLAT at `data/recipes/<slug>.md`.
- Existing `recipeParser.test.js` tests must keep passing unchanged.
- Tests run in Docker: `docker compose run --rm dev npm run test:run` (host `npx vitest run` also works — host has Node 22 + deps).
- Commits: small, TDD, conventional-commit style. **NO Claude authorship and NO `Co-Authored-By` trailer** on any commit (project rule). Use `git commit --no-verify` is NOT required; commit normally.
- Work on branch `fix/recipe-canonical-format` (already created).

---

## File Structure

- Create `src/utils/recipeFormat.js` — `extractRecipe`, `serializeRecipe` (+ private helpers). One responsibility: convert between raw markdown and the structured recipe object.
- Create `src/utils/recipeFormat.test.js` — unit tests for the above.
- Modify `src/utils/recipeParser.js` — delegate field extraction to `extractRecipe`; keep filepath→slug/category logic and public return shape.
- Modify `src/pages/api/recipes.ts` — GET uses `extractRecipe`; POST uses `serializeRecipe` + conditional image `mkdir`. Delete the inline body-parser.
- Modify `src/pages/recipes/[...slug].astro` — delete the frontmatter→body section synthesis (lines ~40-56).
- Create `scripts/migrate-recipes.mjs` — normalize `data/recipes/*.md` and delete empty dirs.

---

## Task 1: `serializeRecipe` (canonical writer)

**Files:**
- Create: `src/utils/recipeFormat.js`
- Test: `src/utils/recipeFormat.test.js`

**Interfaces:**
- Produces: `serializeRecipe(recipe: {title, category, description, prepTime, cookTime, yieldVal, imageUrl, miseEnPlace, ingredients: Array<{item,proportion}|string>, steps: Array<string>}) => string` (raw markdown with YAML frontmatter).

- [ ] **Step 1: Write the failing test**

```js
// src/utils/recipeFormat.test.js
import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import { serializeRecipe } from './recipeFormat';

describe('serializeRecipe', () => {
  it('writes content to the body and keeps only metadata in frontmatter', () => {
    const md = serializeRecipe({
      title: 'Rajma', category: 'Punjabi', description: 'Best with rice.',
      prepTime: '30 min', cookTime: '45 min', yieldVal: '4',
      imageUrl: '', miseEnPlace: [],
      ingredients: [{ item: 'Onion', proportion: '2 large' }, { item: 'Salt', proportion: '' }],
      steps: ['Chop onions.', 'Cook.'],
    });
    const { data, content } = matter(md);

    // Frontmatter has metadata only — never description/ingredients/steps
    expect(data.title).toBe('Rajma');
    expect(data.category).toBe('Punjabi');
    expect(data.prepTime).toBe('30 min');
    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('ingredients');
    expect(data).not.toHaveProperty('steps');

    // Body holds description + one Ingredients + one Instructions section
    expect(content).toContain('Best with rice.');
    expect((content.match(/## Ingredients/g) || []).length).toBe(1);
    expect((content.match(/## Instructions/g) || []).length).toBe(1);
    expect(content).toContain('- **2 large** Onion');
    expect(content).toContain('- Salt');            // empty proportion → no bold
    expect(content).toContain('1. Chop onions.');
    expect(content).toContain('2. Cook.');
  });

  it('omits empty optional frontmatter keys and empty sections', () => {
    const md = serializeRecipe({ title: 'Plain', category: 'General', description: 'Just a note.' });
    const { data, content } = matter(md);
    expect(data).not.toHaveProperty('prepTime');
    expect(data).not.toHaveProperty('imageUrl');
    expect(data).not.toHaveProperty('miseEnPlace');
    expect(content).not.toContain('## Ingredients');
    expect(content).not.toContain('## Instructions');
    expect(content.trim()).toBe('Just a note.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/recipeFormat.test.js`
Expected: FAIL — `serializeRecipe is not a function` / module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/recipeFormat.js
import matter from 'gray-matter';

export function serializeRecipe(recipe = {}) {
  const {
    title = '', category = '', description = '',
    prepTime = '', cookTime = '', yieldVal = '',
    imageUrl = '', miseEnPlace = [],
    ingredients = [], steps = [],
  } = recipe;

  let body = String(description || '').trim();

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    body += '\n\n## Ingredients\n\n';
    for (const ing of ingredients) {
      const item = String(typeof ing === 'string' ? ing : (ing.item || '')).trim();
      const proportion = String(typeof ing === 'string' ? '' : (ing.proportion || '')).trim();
      if (!item && !proportion) continue;
      body += proportion ? `- **${proportion}** ${item}\n` : `- ${item}\n`;
    }
  }

  if (Array.isArray(steps) && steps.length > 0) {
    body += '\n\n## Instructions\n\n';
    steps.forEach((step, i) => {
      const s = String(typeof step === 'string' ? step : String(step)).trim();
      body += `${i + 1}. ${s}\n`;
    });
  }

  const data = { title, category };
  if (prepTime) data.prepTime = prepTime;
  if (cookTime) data.cookTime = cookTime;
  if (yieldVal) data.yieldVal = yieldVal;
  if (imageUrl) data.imageUrl = imageUrl;
  if (Array.isArray(miseEnPlace) && miseEnPlace.length > 0) data.miseEnPlace = miseEnPlace;

  return matter.stringify(body ? `${body.trim()}\n` : '', data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/recipeFormat.test.js`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeFormat.test.js
git commit -m "feat: add serializeRecipe canonical writer (body-authoritative)"
```

---

## Task 2: `extractRecipe` (tolerant reader) + round-trip

**Files:**
- Modify: `src/utils/recipeFormat.js`
- Test: `src/utils/recipeFormat.test.js`

**Interfaces:**
- Consumes: `serializeRecipe` (Task 1).
- Produces: `extractRecipe(rawContent: string) => {title, category, description, prepTime, cookTime, yieldVal, imageUrl, miseEnPlace, ingredients: Array<{item,proportion}>, steps: Array<string>, content: string}`. `category` is `''` when absent from frontmatter. `description` falls back to `"A delicious recipe for {title}."` when nothing is found.

- [ ] **Step 1: Write the failing test**

```js
// append to src/utils/recipeFormat.test.js
import { extractRecipe } from './recipeFormat';

describe('extractRecipe', () => {
  it('reads frontmatter-array recipes (no body sections)', () => {
    const raw = `---
title: Bagel
category: Fusion
ingredients:
  - item: Mushroom
    proportion: 200g
steps:
  - Toast bagel.
---
`;
    const r = extractRecipe(raw);
    expect(r.title).toBe('Bagel');
    expect(r.category).toBe('Fusion');
    expect(r.ingredients).toEqual([{ item: 'Mushroom', proportion: '200g' }]);
    expect(r.steps).toEqual(['Toast bagel.']);
  });

  it('reads ##-heading body sections and a body description (no # heading)', () => {
    const raw = `---
title: Rajma
category: Punjabi
---
Best served with rice.

## Ingredients

- **2 large** Onion

## Instructions

1. Chop onions.
2. Cook.
`;
    const r = extractRecipe(raw);
    expect(r.description).toBe('Best served with rice.');   // Bug A: real description, not fallback
    expect(r.ingredients).toEqual([{ proportion: '2 large', item: 'Onion' }]);
    expect(r.steps).toEqual(['Chop onions.', 'Cook.']);
  });

  it('reads legacy single-#-heading body sections (shahi-kaju shape)', () => {
    const raw = `---
title: Shahi Kaju
description: Creamy cashew curry.
category: Mains
---
# Ingredients
- 250g Paneer

# Instructions
1. Soak cashews.
`;
    const r = extractRecipe(raw);
    expect(r.description).toBe('Creamy cashew curry.');       // from frontmatter
    expect(r.ingredients).toEqual([{ item: '250g Paneer', proportion: '' }]);
    expect(r.steps).toEqual(['Soak cashews.']);
  });

  it('deduplicates: a "both" file yields 2 steps, not 4', () => {
    const raw = `---
title: Dup
steps:
  - One.
  - Two.
---
## Instructions

1. One.
2. Two.
`;
    const r = extractRecipe(raw);
    expect(r.steps).toEqual(['One.', 'Two.']);   // frontmatter wins; body not double-counted
  });

  it('round-trips through serializeRecipe for a recipe with a description', () => {
    const original = {
      title: 'Rajma', category: 'Punjabi', description: 'Best with rice.',
      prepTime: '30 min', cookTime: '45 min', yieldVal: '4', imageUrl: '', miseEnPlace: [],
      ingredients: [{ item: 'Onion', proportion: '2 large' }],
      steps: ['Chop.', 'Cook.'],
    };
    const back = extractRecipe(serializeRecipe(original));
    expect(back.title).toBe('Rajma');
    expect(back.category).toBe('Punjabi');
    expect(back.description).toBe('Best with rice.');
    expect(back.prepTime).toBe('30 min');
    expect(back.ingredients).toEqual([{ proportion: '2 large', item: 'Onion' }]);
    expect(back.steps).toEqual(['Chop.', 'Cook.']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/recipeFormat.test.js`
Expected: FAIL — `extractRecipe is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/utils/recipeFormat.js`:

```js
export function extractRecipe(rawContent = '') {
  const parsed = matter(rawContent || '');
  const data = parsed.data || {};
  const content = parsed.content || '';

  let ingredients = normalizeIngredients(data.ingredients);
  let steps = normalizeSteps(data.steps);
  if (ingredients.length === 0 || steps.length === 0) {
    const fromBody = parseBodySections(content);
    if (ingredients.length === 0) ingredients = fromBody.ingredients;
    if (steps.length === 0) steps = fromBody.steps;
  }

  const title = data.title || deriveTitleFromBody(content) || '';
  const description = data.description
    ? String(data.description)
    : extractDescription(content, title);

  // Metadata: frontmatter wins; fall back to inline **Prep time:** markers in
  // the body (legacy recipes). Preserves recipeParser's existing behavior.
  let prepTime = data.prepTime || '';
  let cookTime = data.cookTime || '';
  let yieldVal = data.yieldVal || '';
  if (!prepTime || !cookTime || !yieldVal) {
    const prepMatch = content.match(/\*\*Prep\s+[Tt]ime:\*\*\s*(.+)$/m);
    const cookMatch = content.match(/\*\*Cook\s+[Tt]ime:\*\*\s*(.+)$/m);
    const yieldMatch = content.match(/\*\*Yield:\*\*\s*(.+)$/m);
    if (!prepTime && prepMatch) prepTime = prepMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    if (!cookTime && cookMatch) cookTime = cookMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    if (!yieldVal && yieldMatch) yieldVal = yieldMatch[1].replace(/<br\s*\/?>/gi, '').trim();
  }

  return {
    title,
    category: data.category || '',
    description,
    prepTime,
    cookTime,
    yieldVal,
    imageUrl: data.imageUrl || '',
    miseEnPlace: Array.isArray(data.miseEnPlace) ? data.miseEnPlace : [],
    ingredients,
    steps,
    content,
  };
}

function normalizeIngredients(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(ing => typeof ing === 'string'
      ? { item: ing.trim(), proportion: '' }
      : { item: String(ing.item || '').trim(), proportion: String(ing.proportion || '').trim() })
    .filter(i => i.item || i.proportion);
}

function normalizeSteps(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => String(typeof s === 'string' ? s : String(s)).trim()).filter(Boolean);
}

function deriveTitleFromBody(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

function parseBodySections(content) {
  const ingredients = [];
  const steps = [];
  let inIngredients = false, inSteps = false;
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (/^#{1,2}\s+ingredient/i.test(t)) { inIngredients = true; inSteps = false; continue; }
    if (/^#{1,2}\s+(instruction|step|method)/i.test(t)) { inSteps = true; inIngredients = false; continue; }
    if (/^#{1,2}\s+/.test(t)) { inIngredients = false; inSteps = false; continue; }
    if (inIngredients && (t.startsWith('- ') || t.startsWith('* '))) {
      const itemStr = t.replace(/^[-*]\s*/, '').trim();
      const m = itemStr.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (m) ingredients.push({ proportion: m[1].trim(), item: m[2].trim() });
      else ingredients.push({ item: itemStr, proportion: '' });
    } else if (inSteps && /^\d+\.\s+/.test(t)) {
      steps.push(t.replace(/^\d+\.\s*/, '').trim());
    } else if (inSteps && (t.startsWith('- ') || t.startsWith('* '))) {
      steps.push(t.replace(/^[-*]\s*/, '').trim());
    }
  }
  return { ingredients, steps };
}

function extractDescription(content, title) {
  let desc = '';
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('# ')) continue;            // legacy title heading
    if (/^#{1,2}\s+/.test(line)) break;             // reached a section heading
    if (line.startsWith('**Prep') || line.startsWith('**Cook') || line.startsWith('**Yield')) continue;
    if (line.startsWith('---') || line.startsWith('*') || line.startsWith('-')) continue;
    desc = line;
    break;
  }
  desc = desc.replace(/\*\*|\*|_/g, '').trim();
  if (!desc) desc = `A delicious recipe for ${title || 'this dish'}.`;
  return desc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/recipeFormat.test.js`
Expected: PASS (all `serializeRecipe` + `extractRecipe` tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeFormat.test.js
git commit -m "feat: add extractRecipe tolerant reader with body-first descriptions"
```

---

## Task 3: `parseRecipe` delegates to `extractRecipe`

**Files:**
- Modify: `src/utils/recipeParser.js`
- Test: `src/utils/recipeParser.test.js` (existing must pass; add one)

**Interfaces:**
- Consumes: `extractRecipe` (Task 2).
- Produces: unchanged public shape `parseRecipe(filePath, rawContent) => {title, category, slug, prepTime, cookTime, yieldVal, imageUrl, miseEnPlace, description, content}`.

- [ ] **Step 1: Write the failing test**

Add to `src/utils/recipeParser.test.js` inside the `describe('recipeParser', ...)`:

```js
  it('extracts a body description when there is no leading # heading (Bug A)', () => {
    const raw = `---
title: Rajma
category: Punjabi
---
Best served with rice.

## Ingredients
- **2 large** Onion
`;
    const result = parseRecipe('data/recipes/rajma.md', raw);
    expect(result.description).toBe('Best served with rice.');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/recipeParser.test.js`
Expected: FAIL — description is `'A delicious recipe for Rajma.'` (old gated logic), not `'Best served with rice.'`.

- [ ] **Step 3: Rewrite `recipeParser.js`**

Replace the entire file with:

```js
import { extractRecipe } from './recipeFormat.js';

/**
 * Parses raw recipe markdown into the shape used by index.astro and the
 * detail page. Delegates field extraction to extractRecipe (single reader);
 * derives slug/category from the file path.
 *
 * @param {string} filePath
 * @param {string} rawContent
 * @returns {object}
 */
export function parseRecipe(filePath, rawContent) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const recipesMatch = normalizedPath.match(/\/[Rr]ecipes\/(.+)$/);
  const relativePath = recipesMatch ? recipesMatch[1] : (normalizedPath.split('/').pop() || '');
  const parts = relativePath.split('/');
  const slug = parts[parts.length - 1].replace(/\.md$/, '').toLowerCase();
  const pathCategory = parts.length > 1 ? parts[0] : 'General';

  const r = extractRecipe(rawContent);

  const title = r.title || slug
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    title,
    category: r.category || pathCategory,
    slug,
    prepTime: r.prepTime || 'N/A',
    cookTime: r.cookTime || 'N/A',
    yieldVal: r.yieldVal || 'N/A',
    imageUrl: r.imageUrl || '',
    miseEnPlace: r.miseEnPlace || [],
    description: r.description,
    content: r.content,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/recipeParser.test.js`
Expected: PASS — the 6 original tests plus the new Bug A test.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeParser.js src/utils/recipeParser.test.js
git commit -m "refactor: parseRecipe delegates to extractRecipe; fix body descriptions"
```

---

## Task 4: API GET/POST use the shared format

**Files:**
- Modify: `src/pages/api/recipes.ts`

**Interfaces:**
- Consumes: `extractRecipe`, `serializeRecipe`.

- [ ] **Step 1: Update the import line**

In `src/pages/api/recipes.ts`, replace:

```ts
import matter from 'gray-matter';
import { sanitiseSlug } from '../../utils/slugUtils';
import { parseRecipe } from '../../utils/recipeParser';
```

with:

```ts
import { sanitiseSlug } from '../../utils/slugUtils';
import { extractRecipe, serializeRecipe } from '../../utils/recipeFormat';
```

(`matter` and `parseRecipe` are no longer used in this file.)

- [ ] **Step 2: Replace the single-recipe GET block**

Replace the body of `if (slug) { ... }` (from `const safeSlug = sanitiseSlug(slug);` through the closing `}` before `async function walk`) with:

```ts
    const safeSlug = sanitiseSlug(slug);
    if (!safeSlug) {
      return new Response(JSON.stringify({ error: 'Invalid slug' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let filePath = path.join(dataDir, safeSlug, `${safeSlug}.md`);
    try {
      await fs.access(filePath);
    } catch {
      filePath = path.join(dataDir, `${safeSlug}.md`);
    }

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const r = extractRecipe(raw);

      let imageUrl = r.imageUrl || '';
      if (!imageUrl) {
        try {
          await fs.access(path.join(dataDir, safeSlug, 'hero.jpg'));
          imageUrl = `/images/${safeSlug}/hero.jpg`;
        } catch { /* no hero image */ }
      }

      return new Response(
        JSON.stringify({ ...r, slug: safeSlug, imageUrl }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }
```

- [ ] **Step 3: Replace the list-walk block that used `matter`**

In the list branch, replace:

```ts
  const recipes = await Promise.all(files.map(async (fp) => {
    const raw = await fs.readFile(fp, 'utf-8');
    const parsed = matter(raw);
    return { slug: path.basename(fp, '.md'), ...parsed.data, content: parsed.content };
  }));
```

with:

```ts
  const recipes = await Promise.all(files.map(async (fp) => {
    const raw = await fs.readFile(fp, 'utf-8');
    const r = extractRecipe(raw);
    return { slug: path.basename(fp, '.md'), ...r };
  }));
```

- [ ] **Step 4: Replace the POST body-building + write**

Replace everything from `let markdownBody = description || '';` through the `await fs.writeFile(...)` line with:

```ts
  const fileContent = serializeRecipe({
    title, category, description,
    prepTime, cookTime, yieldVal,
    imageUrl: finalImageUrl, miseEnPlace: finalMiseEnPlace,
    ingredients, steps,
  });

  const mdFilename = `${recipeSlug}.md`;
  await fs.writeFile(path.join(process.cwd(), 'data', 'recipes', mdFilename), fileContent);
```

- [ ] **Step 5: Make the image dir creation conditional**

In POST, delete the unconditional lines:

```ts
  const recipeDir = path.join(process.cwd(), 'data', 'recipes', recipeSlug);
  await fs.mkdir(recipeDir, { recursive: true });
```

Replace with (declare the dir, create only when a hero image is written):

```ts
  const recipeDir = path.join(process.cwd(), 'data', 'recipes', recipeSlug);
```

Then, inside the `if (imageUrl && imageUrl.startsWith('data:image/'))` block, add `await fs.mkdir(recipeDir, { recursive: true });` as its first statement (before writing the hero file). The mise-en-place block already `mkdir`s its own dir recursively, so no change needed there.

- [ ] **Step 6: Verify unit tests still pass and the app builds**

Run: `npx vitest run`
Expected: PASS (all suites).
Run: `docker compose run --rm dev npm run build`
Expected: build completes with no type/import errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/api/recipes.ts
git commit -m "refactor: API uses extractRecipe/serializeRecipe; conditional image dir"
```

---

## Task 5: Detail page renders body once (no synthesis)

**Files:**
- Modify: `src/pages/recipes/[...slug].astro`

- [ ] **Step 1: Delete the frontmatter→body synthesis**

Remove this block (currently ~lines 40-56):

```ts
if (Array.isArray(frontmatter.ingredients) && frontmatter.ingredients.length > 0) {
  const ingredientLines = frontmatter.ingredients
    .map((ing: any) => {
      if (typeof ing === 'string') return `- ${ing}`;
      const proportion = ing.proportion ? `**${ing.proportion}** — ` : '';
      return `- ${proportion}${ing.item || ''}`;
    })
    .join('\n');
  contentForRender += `\n\n## Ingredients\n${ingredientLines}`;
}

if (Array.isArray(frontmatter.steps) && frontmatter.steps.length > 0) {
  const stepLines = frontmatter.steps
    .map((step: any, i: number) => `${i + 1}. ${String(step).trim()}`)
    .join('\n');
  contentForRender += `\n\n## Instructions\n${stepLines}`;
}
```

Leave `let contentForRender = mdBody.trim();` and the following `const htmlContent = marked.parse(contentForRender || rawContent);` intact. (`frontmatter` may now be unused for sections but is still used elsewhere; leave the `matter(rawContent)` destructure as-is.)

- [ ] **Step 2: Rebuild the app image (source is baked into prod)**

Run: `docker compose build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/recipes/[...slug].astro
git commit -m "fix: render recipe body once; stop synthesizing duplicate sections"
```

---

## Task 6: Migration script for existing files

**Files:**
- Create: `scripts/migrate-recipes.mjs`

**Interfaces:**
- Consumes: `extractRecipe`, `serializeRecipe` from `../src/utils/recipeFormat.js`.

- [ ] **Step 1: Write the migration script**

```js
// scripts/migrate-recipes.mjs
// Normalize every data/recipes/*.md into the canonical body-authoritative
// format, and remove empty per-recipe directories. Idempotent.
import fs from 'node:fs/promises';
import path from 'node:path';
import { extractRecipe, serializeRecipe } from '../src/utils/recipeFormat.js';

const dataDir = path.join(process.cwd(), 'data', 'recipes');

async function main() {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });

  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.md')) {
      const fp = path.join(dataDir, e.name);
      const raw = await fs.readFile(fp, 'utf-8');
      const canonical = serializeRecipe(extractRecipe(raw));
      if (canonical !== raw) {
        await fs.writeFile(fp, canonical);
        console.log(`migrated: ${e.name}`);
      } else {
        console.log(`unchanged: ${e.name}`);
      }
    }
  }

  // Remove empty per-recipe directories (litter from old POST mkdir).
  for (const e of entries) {
    if (e.isDirectory()) {
      const dir = path.join(dataDir, e.name);
      const inner = await fs.readdir(dir);
      if (inner.length === 0) {
        await fs.rmdir(dir);
        console.log(`removed empty dir: ${e.name}/`);
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Dry-run check the transform on one file (no write) before committing**

Run:
```bash
node -e "import('./src/utils/recipeFormat.js').then(async m => { const fs=await import('node:fs/promises'); const raw=await fs.readFile('data/recipes/rajma-ranveer-brar-style.md','utf-8'); const out=m.serializeRecipe(m.extractRecipe(raw)); console.log((out.match(/## Instructions/g)||[]).length, 'Instructions section(s)'); console.log('has steps: in frontmatter?', /^steps:/m.test(out.split('---')[1]||'')); })"
```
Expected: `1 Instructions section(s)` and `has steps: in frontmatter? false`.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/migrate-recipes.mjs
git commit -m "chore: add recipe canonical-format migration script"
```

---

## Task 7: Run migration + deploy

**Files:** none (ops task). Do this only after Tasks 1-6 are committed and `npx vitest run` is green.

- [ ] **Step 1: Back up current data**

Run: `cp -r data/recipes "data/recipes.bak-$(date +%Y%m%d%H%M%S)"`
Expected: a timestamped backup dir exists.

- [ ] **Step 2: Run the migration on host**

Run: `node scripts/migrate-recipes.mjs`
Expected output includes `migrated: rajma-ranveer-brar-style.md`, `migrated: sabudana-khicadi.md`, `migrated: Desi-Italian-Creamy-Mushroom-Bagel.md`, and `removed empty dir: rajma-ranveer-brar-style/` + `removed empty dir: sabudana-khicadi/`.

- [ ] **Step 3: Verify files are canonical (frontmatter has no arrays)**

Run: `grep -lE '^(steps|ingredients|description):' data/recipes/*.md || echo "CLEAN: no arrays/description in any frontmatter"`
Expected: `CLEAN: ...` (note: frontmatter `description:` also removed — description now lives in body).

- [ ] **Step 4: Rebuild and restart the prod container**

Run: `docker compose build && docker compose up -d`
Expected: container `svens-cookbook-app` recreated and healthy on `:4321`.

- [ ] **Step 5: Verify both bugs are fixed against the running app**

Run (Bug B — steps rendered once):
```bash
curl -s "http://localhost:4321/recipes/rajma-ranveer-brar-style" | grep -o "Chop your 1.5 large onions" | wc -l
```
Expected: `1`.

Run (Bug A — real description returned, not the fallback):
```bash
curl -s "http://localhost:4321/api/recipes?slug=rajma-ranveer-brar-style" | python3 -c "import sys,json;print(json.load(sys.stdin)['description'])"
```
Expected: the real description text (e.g. starts with "Best served" / the migrated first paragraph), NOT "A delicious recipe for Rajma - Ranveer Brar Style."

- [ ] **Step 6: Manual round-trip check (the actual user bug)**

In a browser: open `/editor?slug=rajma-ranveer-brar-style`, change the description, save, reopen the editor. Expected: the edited description persists (no longer dropped). Confirm the detail page shows steps 1-13 exactly once.

---

## Self-Review

- **Spec coverage:** canonical format (Task 1); single reader (Task 2); single writer (Task 1); parseRecipe consolidation (Task 3); GET/POST + conditional mkdir (Task 4); detail-page de-duplication (Task 5); migration + empty-dir cleanup (Task 6); deploy + verification (Task 7); Bug A regression (Task 2 + Task 3 tests); Bug B regression (Task 1 + Task 2 tests). All spec sections mapped.
- **Placeholders:** none — every code step shows full code; every run step shows the command and expected output.
- **Type consistency:** `extractRecipe`/`serializeRecipe` signatures identical across Tasks 1-6; ingredient shape `{item, proportion}` and step shape `string` consistent throughout; `parseRecipe` return shape unchanged from the original file.
