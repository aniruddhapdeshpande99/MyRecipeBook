# Recipe Format Review-Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 8 findings from the `/code-review max` of `fix/recipe-canonical-format` — chiefly the lossy round-trip (multi-paragraph descriptions, description punctuation) — and recover the already-lost Rajma paragraph from backup.

**Architecture:** Introduce one shared `recipeBodyMarkdown(structured)` writer used by both `serializeRecipe` and the detail page, so there is a single canonical body renderer. Make `extractRecipe` preserve the full multi-paragraph description verbatim and restore the legacy `## info` metadata fallback. Harden the API (category default, dir creation) and the migration (recursive), then re-migrate from the pre-fix backup to recover lost content.

**Tech Stack:** Astro 6 SSR, Node 22, `gray-matter`, `marked`, Vitest, Docker.

## Global Constraints

- Body/Markdown is the single source of truth. Frontmatter holds metadata only (never `description`/`ingredients`/`steps`).
- Description is preserved **verbatim and multi-line** — no stripping of `*`, `_`, or `**`.
- The existing `recipeParser.test.js` (7 tests) and `recipeFormat.test.js` tests must keep passing (amend only where a test encodes the old lossy behavior, and only as the tasks below specify).
- Recipe `.md` files stay FLAT at `data/recipes/<slug>.md`; category subfolders are read-only legacy that migration must still visit.
- Tests run in Docker: `docker compose run --rm dev npx vitest run <files>` (reliable on this WSL mount; host `npx vitest` is flaky).
- Commits: small, TDD, conventional-commit; **NO Claude authorship / NO `Co-Authored-By` trailer** (project rule).
- Work on the existing branch `fix/recipe-canonical-format`.
- The pre-fix data backup is `data/recipes.bak-20260705211848/` (contains Rajma's lost "Bonus - Spiced Lemon Onion Salad" paragraph).

## Non-goals (documented, not fixed here)

- Round-tripping arbitrary `## Notes`/`## Tips` sections and `###` ingredient-subgroup headings through the **editor**. These need editor UI + a richer data model (the structured React editor has no field for them, and pre-existing saves already dropped them). No current recipe uses them. Tracked in the review-findings doc as a follow-up feature.

## File Structure

- `src/utils/recipeFormat.js` — add `recipeBodyMarkdown`; refactor `serializeRecipe` to use it (fixes G); fix `extractDescription` (multi-line, verbatim → A/B); restore `## info` metadata fallback (E).
- `src/utils/recipeFormat.test.js` — tests for the above.
- `src/pages/recipes/[...slug].astro` — render via `recipeBodyMarkdown(extractRecipe(raw))` (fixes C).
- `src/pages/api/recipes.ts` — category default (F), ensure data dir before write (H).
- `scripts/migrate-recipes.mjs` — recurse into subfolders (D).
- `docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md` — mark resolved.

---

## Task 1: Shared `recipeBodyMarkdown` writer (fixes G) + serializeRecipe refactor

**Files:**
- Modify: `src/utils/recipeFormat.js`
- Test: `src/utils/recipeFormat.test.js`

**Interfaces:**
- Produces: `recipeBodyMarkdown(recipe: {description, ingredients, steps}) => string` (canonical body markdown, no frontmatter). `serializeRecipe` unchanged signature, now built on it.

- [ ] **Step 1: Write the failing test**

Add to `src/utils/recipeFormat.test.js`:

```js
import { recipeBodyMarkdown } from './recipeFormat';

describe('recipeBodyMarkdown', () => {
  it('builds description + one Ingredients + one Instructions section', () => {
    const body = recipeBodyMarkdown({
      description: 'Tasty.',
      ingredients: [{ item: 'Onion', proportion: '2' }, { item: 'Salt', proportion: '' }],
      steps: ['Chop.', 'Cook.'],
    });
    expect(body).toContain('Tasty.');
    expect((body.match(/## Ingredients/g) || []).length).toBe(1);
    expect((body.match(/## Instructions/g) || []).length).toBe(1);
    expect(body).toContain('- **2** Onion');
    expect(body).toContain('- Salt');
    expect(body).toContain('1. Chop.');
  });

  it('omits a heading when every entry is blank (no dangling heading)', () => {
    const body = recipeBodyMarkdown({ description: 'Note.', ingredients: [{ item: '', proportion: '' }], steps: [] });
    expect(body).not.toContain('## Ingredients');
    expect(body).not.toContain('## Instructions');
    expect(body.trim()).toBe('Note.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js`
Expected: FAIL — `recipeBodyMarkdown is not a function`.

- [ ] **Step 3: Implement**

In `src/utils/recipeFormat.js`, add the exported helper and refactor `serializeRecipe` to use it. Replace the current `serializeRecipe` (lines 3-39) with:

```js
export function recipeBodyMarkdown(recipe = {}) {
  const { description = '', ingredients = [], steps = [] } = recipe;
  let body = String(description || '').trim();

  const ings = (Array.isArray(ingredients) ? ingredients : [])
    .map(ing => typeof ing === 'string'
      ? { item: ing.trim(), proportion: '' }
      : { item: String(ing.item || '').trim(), proportion: String(ing.proportion || '').trim() })
    .filter(i => i.item || i.proportion);
  if (ings.length > 0) {
    body += '\n\n## Ingredients\n\n';
    for (const ing of ings) {
      body += ing.proportion ? `- **${ing.proportion}** ${ing.item}\n` : `- ${ing.item}\n`;
    }
  }

  const sts = (Array.isArray(steps) ? steps : [])
    .map(s => String(typeof s === 'string' ? s : String(s)).trim())
    .filter(Boolean);
  if (sts.length > 0) {
    body += '\n\n## Instructions\n\n';
    sts.forEach((s, i) => { body += `${i + 1}. ${s}\n`; });
  }

  return body.trim();
}

export function serializeRecipe(recipe = {}) {
  const {
    title = '', category = '',
    prepTime = '', cookTime = '', yieldVal = '',
    imageUrl = '', miseEnPlace = [],
  } = recipe;

  const body = recipeBodyMarkdown(recipe);

  const data = { title, category };
  if (prepTime) data.prepTime = prepTime;
  if (cookTime) data.cookTime = cookTime;
  if (yieldVal) data.yieldVal = yieldVal;
  if (imageUrl) data.imageUrl = imageUrl;
  if (Array.isArray(miseEnPlace) && miseEnPlace.length > 0) data.miseEnPlace = miseEnPlace;

  return matter.stringify(body ? `${body}\n` : '', data);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js`
Expected: PASS (existing serializeRecipe/extractRecipe tests + the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeFormat.test.js
git commit -m "refactor: shared recipeBodyMarkdown writer; drop dangling headings"
```

---

## Task 2: Multi-paragraph verbatim description (fixes A-description, B) + restore `## info` metadata (E)

**Files:**
- Modify: `src/utils/recipeFormat.js`
- Test: `src/utils/recipeFormat.test.js`

**Interfaces:**
- Consumes: nothing new. `extractRecipe` return shape unchanged; `description` may now contain multiple lines and literal `*`/`_`.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/recipeFormat.test.js`:

```js
describe('extractRecipe description fidelity', () => {
  it('preserves a multi-paragraph description before the first section', () => {
    const raw = `---
title: Rajma
---
First paragraph of the description.

Bonus - Spiced Lemon Onion Salad

## Ingredients

- **2** Onion
`;
    const r = extractRecipe(raw);
    expect(r.description).toBe('First paragraph of the description.\n\nBonus - Spiced Lemon Onion Salad');
  });

  it('does not strip literal * or _ from the description', () => {
    const raw = `---
title: X
---
Mom's *Famous* Chili_Verde.

## Ingredients

- Beans
`;
    expect(extractRecipe(raw).description).toBe("Mom's *Famous* Chili_Verde.");
  });

  it('reads prep/yield from a legacy ## info bullet block', () => {
    const raw = `---
title: Old
---
A classic.

## info
- 25 minutes
- Serves 4

## Ingredients
- Flour
`;
    const r = extractRecipe(raw);
    expect(r.prepTime).toBe('25 minutes');
    expect(r.yieldVal).toBe('Serves 4');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js`
Expected: FAIL — description returns only the first line / strips `*_` / no `## info` parsing.

- [ ] **Step 3: Implement**

In `src/utils/recipeFormat.js`, replace `extractDescription` (lines ~130-145) with the multi-line, verbatim version:

```js
function extractDescription(content, title) {
  const collected = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s+/.test(line)) break;                                   // ## section heading
    if (/^#\s+(ingredient|instruction|step|method|note|tip)/i.test(line)) break; // legacy single-# section
    if (line.startsWith('# ')) continue;                              // legacy title heading
    if (line.startsWith('**Prep') || line.startsWith('**Cook') || line.startsWith('**Yield')) continue;
    if (line.startsWith('---')) continue;
    collected.push(raw);
  }
  const desc = collected.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return desc || `A delicious recipe for ${title || 'this dish'}.`;
}
```

Then, in `extractRecipe`, restore the legacy `## info` metadata fallback. Immediately after the existing inline-`**Prep time:**` block (after line ~71, before the `return {`), insert:

```js
  // Legacy "## info" bullet block: first time-like bullet → prep, next → cook,
  // servings/yield/makes bullet → yield. (Restores old recipeParser behavior.)
  if (!prepTime || !yieldVal) {
    const infoMatch = content.match(/##\s+info\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (infoMatch) {
      const infoLines = infoMatch[1].split(/\r?\n/).map(l => l.trim())
        .filter(l => l.startsWith('*') || l.startsWith('-'));
      for (const l of infoLines) {
        const text = l.replace(/^[\*\-\s]+/, '').trim();
        if (/time|minute|hour/i.test(text)) {
          if (!prepTime) prepTime = text;
          else if (!cookTime) cookTime = text;
        } else if (/serving|yield|makes/i.test(text)) {
          if (!yieldVal) yieldVal = text;
        }
      }
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js src/utils/recipeParser.test.js`
Expected: PASS — new description/info tests plus all existing recipeFormat and recipeParser tests (the legacy "A wonderful potato and pea curry." single-line case still resolves correctly).

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeFormat.test.js
git commit -m "fix: preserve multi-paragraph verbatim descriptions; restore ## info metadata"
```

---

## Task 3: Detail page renders canonical body from structured data (fixes C)

**Files:**
- Modify: `src/pages/recipes/[...slug].astro`

- [ ] **Step 1: Update imports**

Replace the import line `import { marked } from 'marked';` region — specifically change:

```ts
import { parseRecipe } from '../../utils/recipeParser';
import { sanitiseSlug } from '../../utils/slugUtils';
import fsPromises from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import matter from 'gray-matter';
```

with (drop `matter`, add `recipeBodyMarkdown`/`extractRecipe`):

```ts
import { parseRecipe } from '../../utils/recipeParser';
import { extractRecipe, recipeBodyMarkdown } from '../../utils/recipeFormat';
import { sanitiseSlug } from '../../utils/slugUtils';
import fsPromises from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
```

- [ ] **Step 2: Render from the canonical structured body**

Replace the current render block (lines ~33-39):

```ts
// The markdown body is the single source of truth: it already contains the
// description plus the ## Ingredients and ## Instructions sections. Render it
// as-is — do NOT synthesize sections from frontmatter (that caused duplicates).
const { content: mdBody } = matter(rawContent);
const contentForRender = mdBody.trim();

const htmlContent = marked.parse(contentForRender || rawContent);
```

with:

```ts
// Render from the canonical structured recipe, so the page is correct for ANY
// on-disk shape (frontmatter-array, legacy #-heading, or canonical body) and
// never leaks raw YAML. recipeBodyMarkdown emits exactly one of each section.
const contentForRender = recipeBodyMarkdown(extractRecipe(rawContent));
const htmlContent = marked.parse(contentForRender);
```

- [ ] **Step 3: Verify build**

Run: `docker compose run --rm dev npm run build`
Expected: build completes, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/recipes/[...slug].astro"
git commit -m "fix: render recipe detail from canonical structured body (no raw frontmatter)"
```

---

## Task 4: API category default (F) + ensure data dir on write (H)

**Files:**
- Modify: `src/pages/api/recipes.ts`

- [ ] **Step 1: Default category in the single-recipe GET**

In the single-recipe GET return, change:

```ts
      return new Response(
        JSON.stringify({ ...r, slug: safeSlug, imageUrl }),
```

to:

```ts
      return new Response(
        JSON.stringify({ ...r, category: r.category || 'General', slug: safeSlug, imageUrl }),
```

- [ ] **Step 2: Default category in the list endpoint**

Change:

```ts
    const r = extractRecipe(raw);
    return { slug: path.basename(fp, '.md'), ...r };
```

to:

```ts
    const r = extractRecipe(raw);
    return { slug: path.basename(fp, '.md'), ...r, category: r.category || 'General' };
```

- [ ] **Step 3: Ensure the recipes dir exists before writing (POST)**

In `POST`, immediately before the final `await fs.writeFile(path.join(process.cwd(), 'data', 'recipes', mdFilename), fileContent);`, add:

```ts
  await fs.mkdir(path.join(process.cwd(), 'data', 'recipes'), { recursive: true });
```

- [ ] **Step 4: Verify build**

Run: `docker compose run --rm dev npm run build`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/recipes.ts
git commit -m "fix: API defaults category to General; POST ensures recipes dir exists"
```

---

## Task 5: Recursive migration (fixes D)

**Files:**
- Modify: `scripts/migrate-recipes.mjs`

- [ ] **Step 1: Rewrite the script to recurse**

Replace the whole file with:

```js
// scripts/migrate-recipes.mjs
// Normalize every data/recipes/**/*.md into the canonical body-authoritative
// format, and remove empty per-recipe directories. Idempotent, recursive.
import fs from 'node:fs/promises';
import path from 'node:path';
import { extractRecipe, serializeRecipe } from '../src/utils/recipeFormat.js';

const dataDir = path.join(process.cwd(), 'data', 'recipes');

async function migrateDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await migrateDir(full);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      const raw = await fs.readFile(full, 'utf-8');
      const canonical = serializeRecipe(extractRecipe(raw));
      const rel = path.relative(dataDir, full);
      if (canonical !== raw) {
        await fs.writeFile(full, canonical);
        console.log(`migrated: ${rel}`);
      } else {
        console.log(`unchanged: ${rel}`);
      }
    }
  }

  // Remove now-empty subdirectories (litter from old POST mkdir), bottom-up.
  for (const e of entries) {
    if (e.isDirectory()) {
      const full = path.join(dir, e.name);
      if ((await fs.readdir(full)).length === 0) {
        await fs.rmdir(full);
        console.log(`removed empty dir: ${path.relative(dataDir, full)}/`);
      }
    }
  }
}

migrateDir(dataDir).catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Dry-run sanity check (no writes) that the transform still dedups and now keeps the Bonus paragraph from backup**

Run:
```bash
node -e "import('./src/utils/recipeFormat.js').then(async m => { const fs=await import('node:fs/promises'); const raw=await fs.readFile('data/recipes.bak-20260705211848/rajma-ranveer-brar-style.md','utf-8'); const out=m.serializeRecipe(m.extractRecipe(raw)); console.log('Instructions:',(out.match(/## Instructions/g)||[]).length); console.log('keeps Bonus:', out.includes('Bonus - Spiced Lemon Onion Salad')); })"
```
Expected: `Instructions: 1` and `keeps Bonus: true`.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-recipes.mjs
git commit -m "fix: make recipe migration recursive into category subfolders"
```

---

## Task 6: Recover lost data + re-migrate + redeploy + verify

**Files:** none (ops). Do only after Tasks 1-5 are committed and `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js src/utils/recipeParser.test.js` is green.

- [ ] **Step 1: Restore the 4 recipe files from the pre-fix backup**

Run: `cp -f data/recipes.bak-20260705211848/*.md data/recipes/`
Expected: no error (overwrites the current canonical files with the originals so re-migration captures the full descriptions). Note: these originals are root-owned; if `cp` fails with permission denied, run it inside the container: `docker compose run --rm -v "$(pwd)/data:/app/data" dev sh -c "cp -f /app/data/recipes.bak-20260705211848/*.md /app/data/recipes/"`.

- [ ] **Step 2: Re-run the fixed migration inside the dev container (root owns the files)**

Run: `docker compose run --rm -v "$(pwd)/scripts:/app/scripts" dev node scripts/migrate-recipes.mjs`
Expected: `migrated:` lines for the 4 recipes; no errors.

- [ ] **Step 3: Verify recovery + canonical shape**

Run:
```bash
grep -c "Bonus - Spiced Lemon Onion Salad" data/recipes/rajma-ranveer-brar-style.md
grep -lE '^(steps|ingredients|description):' data/recipes/*.md || echo "CLEAN frontmatter"
for f in data/recipes/*.md; do echo "$(basename $f): I=$(grep -c '^## Ingredients' $f) S=$(grep -c '^## Instructions' $f)"; done
```
Expected: Bonus count `1`; `CLEAN frontmatter`; every file `I=1 S=1`.

- [ ] **Step 4: Rebuild + restart, wait for ready**

Run: `docker compose build && docker compose up -d`
Then: `for i in $(seq 1 20); do curl -sf http://localhost:4321/ -o /dev/null && break; sleep 3; done`
Expected: container healthy on :4321.

- [ ] **Step 5: Verify all findings' live behavior**

Run:
```bash
# Bug B still fixed (steps once)
curl -s http://localhost:4321/recipes/rajma-ranveer-brar-style | grep -c "Chop your 1.5 large onions"
# A/B: full multi-paragraph, verbatim description round-trips
curl -s "http://localhost:4321/api/recipes?slug=rajma-ranveer-brar-style" | python3 -c "import sys,json;d=json.load(sys.stdin)['description'];print('has Bonus:', 'Bonus - Spiced Lemon Onion Salad' in d)"
# All 4 recipes still present incl bagel
curl -s http://localhost:4321/ | grep -oE '/recipes/[a-z0-9-]+' | sort -u | wc -l
```
Expected: `1`; `has Bonus: True`; `4`.

- [ ] **Step 6: Manual round-trip in the editor**

Open `/editor?slug=rajma-ranveer-brar-style`, confirm the description textarea shows both paragraphs (including "Bonus - Spiced Lemon Onion Salad"), edit and save, reopen — the multi-paragraph description persists.

---

## Task 7: Update the review-findings doc

**Files:**
- Modify: `docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md`

- [ ] **Step 1: Mark findings resolved**

Under each of findings A (description part), B, C, D, E, F, G, H, append a line `**Resolved:** <plan task that fixed it>`. Under finding A's Notes/`###` sub-case and the `###` subgroup finding, append `**Deferred (non-goal):** needs editor UI + ingredient-group model; no recipe affected.`

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md
git commit -m "docs: mark review findings resolved (format review-fixes)"
```

---

## Self-Review

- **Finding coverage:** A-description → Task 2 (+ recovery Task 6); B → Task 2; C → Task 3; D → Task 5; E → Task 2; F → Task 4; G → Task 1; H → Task 4. A-Notes/`###` subgroups → documented non-goal (Task 7). All 8 findings mapped.
- **Placeholders:** none — every code step has full code; every run step has command + expected output.
- **Type consistency:** `recipeBodyMarkdown(recipe)` defined in Task 1 is consumed identically in Task 3; `serializeRecipe`/`extractRecipe` signatures unchanged; description remains a `string` (now possibly multi-line) everywhere.
- **Regression guard:** Task 2 Step 4 runs the full recipeParser + recipeFormat suites to confirm the legacy single-line description test still passes under the new multi-line extractor.
