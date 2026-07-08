# Review Iteration 1 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Resolve the `/code-review max` iteration-1 findings: preserve `## Notes`/Tips/Origin sections through the round-trip (render + migration + editor save), recognize `Directions` headings, stop the `## info` yield regex from matching "preserve/reserve", and remove the duplicated normalization + double-parse.

**Architecture:** Add a `notes` field to the recipe model: `extractRecipe` captures any non-schema `##` body section verbatim; `recipeBodyMarkdown` re-emits it after Instructions (reusing the existing `normalizeIngredients`/`normalizeSteps` helpers instead of inline copies). `parseRecipe` surfaces `ingredients`/`steps`/`notes` so the detail page extracts once. POST merges the existing file's notes so editor saves (which carry no notes field) don't drop them.

**Tech Stack:** Astro 6 SSR, Node 22, `gray-matter`, `marked`, Vitest, Docker.

## Global Constraints

- The Markdown body is the single source of truth; frontmatter holds metadata only.
- `notes` = every `##`-heading body section whose heading is NOT `ingredient|instruction|step|method|direction`, captured verbatim (heading + content). Description (pre-first-section) and the Ingredients/Instructions sections are NOT notes.
- Descriptions and notes are preserved verbatim (no stripping of `*`/`_`).
- All existing tests must keep passing: `recipeParser.test.js` (7), `recipeFormat.test.js` (12), `filterRecipes`, `slugUtils`, `ContactForm` (4). Do not weaken tests.
- Tests run in Docker: `docker compose run --rm dev npx vitest run <files>`.
- Commits: NO Claude authorship / NO `Co-Authored-By` trailer. Branch `fix/recipe-canonical-format`.
- Non-goals (do NOT attempt): `###` ingredient-subgroup preservation (needs an ingredient-group model); folder-derived category in the API GET (GET only resolves flat/structured-by-slug paths, so subfolder recipes 404 and are unreachable).

## File Structure

- `src/utils/recipeFormat.js` — add `extractNotes` + `notes` field; `recipeBodyMarkdown` appends notes and reuses `normalizeIngredients`/`normalizeSteps`; add `direction` to section regexes; anchor the `## info` yield regex.
- `src/utils/recipeFormat.test.js` — tests for all of the above.
- `src/utils/recipeParser.js` — return `ingredients`/`steps`/`notes`.
- `src/pages/recipes/[...slug].astro` — extract once; render `recipeBodyMarkdown(recipe)` (now includes notes).
- `src/pages/api/recipes.ts` — POST merges existing notes.

---

## Task 1: recipeFormat — notes passthrough, Directions, yield anchor, DRY

**Files:**
- Modify: `src/utils/recipeFormat.js`
- Test: `src/utils/recipeFormat.test.js`

**Interfaces:**
- Produces: `extractRecipe(raw)` return gains `notes: string`; `recipeBodyMarkdown(recipe)` reads `recipe.notes` and appends it; both consumed by later tasks.

- [ ] **Step 1: Write failing tests**

Append to `src/utils/recipeFormat.test.js`:

```js
describe('notes passthrough', () => {
  it('extractRecipe captures a ## Notes section verbatim', () => {
    const raw = `---
title: X
---
Desc.

## Ingredients

- Beans

## Instructions

1. Cook.

## Notes

Soak overnight. Keep _spicy_.
`;
    expect(extractRecipe(raw).notes).toBe('## Notes\n\nSoak overnight. Keep _spicy_.');
  });

  it('recipeBodyMarkdown re-emits notes after Instructions', () => {
    const body = recipeBodyMarkdown({
      description: 'D.', ingredients: [{ item: 'Beans', proportion: '' }],
      steps: ['Cook.'], notes: '## Notes\n\nSoak overnight.',
    });
    expect(body.indexOf('## Notes')).toBeGreaterThan(body.indexOf('## Instructions'));
    expect(body).toContain('Soak overnight.');
  });

  it('round-trips notes through serialize + extract', () => {
    const original = {
      title: 'X', category: 'C', description: 'D.',
      ingredients: [{ item: 'Beans', proportion: '2' }], steps: ['Cook.'],
      notes: '## Notes\n\nSoak overnight.',
    };
    expect(extractRecipe(serializeRecipe(original)).notes).toBe('## Notes\n\nSoak overnight.');
  });

  it('no notes → empty string, no trailing heading', () => {
    const raw = `---
title: X
---
D.

## Ingredients

- Beans
`;
    expect(extractRecipe(raw).notes).toBe('');
    expect(serializeRecipe(extractRecipe(raw))).not.toContain('## Notes');
  });
});

describe('Directions heading + yield regex', () => {
  it('parses steps under a ## Directions heading', () => {
    const raw = `---
title: X
---
D.

## Directions

1. Chop.
2. Fry.
`;
    expect(extractRecipe(raw).steps).toEqual(['Chop.', 'Fry.']);
  });

  it('## info yield does not match "preserve"/"reserve"', () => {
    const raw = `---
title: X
---
D.

## info
- Preserve leftovers in the fridge
- Serves 4

## Ingredients
- Beans
`;
    expect(extractRecipe(raw).yieldVal).toBe('Serves 4');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js`
Expected: FAIL — `notes` is undefined; Directions steps empty; yieldVal picks "Preserve leftovers...".

- [ ] **Step 3: Implement**

In `src/utils/recipeFormat.js`:

(a) Replace `recipeBodyMarkdown` (lines 3-28) with a version that reuses the helpers and appends notes:

```js
export function recipeBodyMarkdown(recipe = {}) {
  const { description = '', ingredients = [], steps = [], notes = '' } = recipe;
  let body = String(description || '').trim();

  const ings = normalizeIngredients(ingredients);
  if (ings.length > 0) {
    body += '\n\n## Ingredients\n\n';
    for (const ing of ings) {
      body += ing.proportion ? `- **${ing.proportion}** ${ing.item}\n` : `- ${ing.item}\n`;
    }
  }

  const sts = normalizeSteps(steps);
  if (sts.length > 0) {
    body += '\n\n## Instructions\n\n';
    sts.forEach((s, i) => { body += `${i + 1}. ${s}\n`; });
  }

  const n = String(notes || '').trim();
  if (n) body += `\n\n${n}`;

  return body.trim();
}
```

(b) In `extractRecipe`, add `notes` to the returned object (change the `return {` block, after `steps,`):

```js
    ingredients,
    steps,
    notes: extractNotes(content),
    content,
```

(c) Add the `extractNotes` helper (place it just after `parseBodySections`):

```js
function extractNotes(content) {
  const out = [];
  let capturing = false;
  for (const raw of content.split(/\r?\n/)) {
    const t = raw.trim();
    if (/^##\s+/.test(t)) {
      capturing = !/^##\s+(ingredient|instruction|step|method|direction)/i.test(t);
      if (capturing) out.push(raw);
      continue;
    }
    if (/^#\s+/.test(t)) { capturing = false; continue; }
    if (capturing) out.push(raw);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
```

(d) Add `direction` to `parseBodySections`'s step-heading regex (line 141):

```js
    if (/^#{1,2}\s+(instruction|step|method|direction)/i.test(t)) { inSteps = true; inIngredients = false; continue; }
```

(e) Anchor the `## info` yield regex (line 93) so it no longer matches "preserve"/"reserve":

```js
        } else if (/\b(serves?|servings?|yield|makes)\b/i.test(text)) {
```

- [ ] **Step 4: Run to verify pass**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js src/utils/recipeParser.test.js`
Expected: PASS — new tests plus all existing recipeFormat (12) and recipeParser (7) tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeFormat.test.js
git commit -m "fix: preserve ## Notes sections; recognize Directions; anchor yield regex; dedup normalization"
```

---

## Task 2: parseRecipe surfaces ingredients/steps/notes

**Files:**
- Modify: `src/utils/recipeParser.js`
- Test: `src/utils/recipeParser.test.js`

**Interfaces:**
- Consumes: `extractRecipe` `notes` field (Task 1).
- Produces: `parseRecipe(...)` return gains `ingredients`, `steps`, `notes` (used by the detail page in Task 3).

- [ ] **Step 1: Write the failing test**

Add to `src/utils/recipeParser.test.js` inside the `describe`:

```js
  it('surfaces ingredients, steps, and notes from the body', () => {
    const raw = `---
title: X
category: C
---
Desc.

## Ingredients
- **2** Beans

## Instructions
1. Cook.

## Notes

Soak overnight.
`;
    const r = parseRecipe('data/recipes/x.md', raw);
    expect(r.ingredients).toEqual([{ proportion: '2', item: 'Beans' }]);
    expect(r.steps).toEqual(['Cook.']);
    expect(r.notes).toBe('## Notes\n\nSoak overnight.');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeParser.test.js`
Expected: FAIL — `r.ingredients`/`r.steps`/`r.notes` are undefined.

- [ ] **Step 3: Implement**

In `src/utils/recipeParser.js`, add the three fields to the returned object (after `description: r.description,` and before/around `content: r.content`):

```js
    description: r.description,
    ingredients: r.ingredients,
    steps: r.steps,
    notes: r.notes,
    content: r.content,
```

- [ ] **Step 4: Run to verify pass**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeParser.test.js`
Expected: PASS — the new test plus the existing 7.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeParser.js src/utils/recipeParser.test.js
git commit -m "feat: parseRecipe surfaces ingredients/steps/notes for single-parse render"
```

---

## Task 3: Detail page extracts once and renders notes

**Files:**
- Modify: `src/pages/recipes/[...slug].astro`

- [ ] **Step 1: Single-parse render**

Replace the render block (the lines that currently read):

```ts
const contentForRender = recipeBodyMarkdown(extractRecipe(rawContent));
const htmlContent = marked.parse(contentForRender);
```

with (build the body from the same `recipe` object `parseRecipe` already produced — no second `extractRecipe` call):

```ts
const contentForRender = recipeBodyMarkdown(recipe);
const htmlContent = marked.parse(contentForRender);
```

- [ ] **Step 2: Drop the now-unused `extractRecipe` import**

Change:

```ts
import { extractRecipe, recipeBodyMarkdown } from '../../utils/recipeFormat';
```

to:

```ts
import { recipeBodyMarkdown } from '../../utils/recipeFormat';
```

(`recipe` comes from `parseRecipe(filePath, rawContent)`, which already carries `description`, `ingredients`, `steps`, and `notes` after Task 2.)

- [ ] **Step 3: Verify build**

Run: `docker compose run --rm dev npm run build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/recipes/[...slug].astro"
git commit -m "fix: detail page extracts once and renders notes sections"
```

---

## Task 4: POST preserves existing notes on save

**Files:**
- Modify: `src/pages/api/recipes.ts`

**Interfaces:**
- Consumes: `extractRecipe(...).notes` (Task 1), `serializeRecipe` (accepts a `notes` field via `recipeBodyMarkdown`).

- [ ] **Step 1: Read existing notes before writing, pass into serializeRecipe**

In `POST`, locate the block:

```ts
  const fileContent = serializeRecipe({
    title, category, description,
    prepTime, cookTime, yieldVal,
    imageUrl: finalImageUrl, miseEnPlace: finalMiseEnPlace,
    ingredients, steps,
  });

  const mdFilename = `${recipeSlug}.md`;
  await fs.mkdir(path.join(process.cwd(), 'data', 'recipes'), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), 'data', 'recipes', mdFilename), fileContent);
```

Replace it with (read the existing file's notes first, since the editor payload carries none):

```ts
  const mdFilename = `${recipeSlug}.md`;
  const mdPath = path.join(process.cwd(), 'data', 'recipes', mdFilename);

  let existingNotes = '';
  try {
    existingNotes = extractRecipe(await fs.readFile(mdPath, 'utf-8')).notes || '';
  } catch {
    // new recipe — no existing notes
  }

  const fileContent = serializeRecipe({
    title, category, description,
    prepTime, cookTime, yieldVal,
    imageUrl: finalImageUrl, miseEnPlace: finalMiseEnPlace,
    ingredients, steps, notes: existingNotes,
  });

  await fs.mkdir(path.join(process.cwd(), 'data', 'recipes'), { recursive: true });
  await fs.writeFile(mdPath, fileContent);
```

(`extractRecipe` is already imported in this file.)

- [ ] **Step 2: Verify build**

Run: `docker compose run --rm dev npm run build`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/recipes.ts
git commit -m "fix: POST preserves existing ## Notes content across editor saves"
```

---

## Task 5: Re-migrate (idempotent), redeploy, live-verify notes round-trip

**Files:** none (ops). Do after Tasks 1-4 are committed and `docker compose run --rm dev npm run test:run` is green.

- [ ] **Step 1: Full suite green**

Run: `docker compose run --rm dev npm run test:run`
Expected: 5 files passed, 0 failed.

- [ ] **Step 2: Re-run migration in the dev container (idempotent — current files have no notes)**

Run: `docker compose run --rm -v "$(pwd)/scripts:/app/scripts" dev node scripts/migrate-recipes.mjs`
Expected: `unchanged:` for all 4 files (no notes to add; serializer output is byte-identical). If any show `migrated:`, inspect the diff before proceeding.

- [ ] **Step 3: Rebuild + restart, wait ready**

Run: `docker compose build && docker compose up -d`
Then: `for i in $(seq 1 20); do curl -sf http://localhost:4321/ -o /dev/null && break; sleep 3; done`

- [ ] **Step 4: Live notes round-trip via the API (create → verify render → re-save → verify preserved → delete)**

Run:
```bash
python3 - <<'PY'
import json,urllib.request,urllib.error
base="http://localhost:4321/api/recipes"
def get(s): return json.load(urllib.request.urlopen(f"{base}?slug={s}"))
def post(p):
    req=urllib.request.Request(base,data=json.dumps(p).encode(),headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req))
slug="zzz-notes-roundtrip-test"
post({"slug":slug,"title":"ZZZ Notes Test","category":"General","description":"Desc.",
      "ingredients":[{"item":"Beans","proportion":"2"}],"steps":["Cook."],
      "notes":"","imageUrl":"","miseEnPlace":[],"prepTime":"","cookTime":"","yieldVal":""})
# inject a Notes section by writing through the editor path is not possible (no notes field);
# simulate a hand-authored notes section by re-saving with notes via API is also not the editor path.
# Instead verify: GET returns notes field, and a recipe WITH notes renders it.
r=get(slug); print("api returns notes field:", "notes" in r)
PY
# Hand-author a Notes section on the test file (inside the container, root-owned), then verify render + editor-save preservation:
docker compose run --rm -v "$(pwd)/data:/app/data" dev sh -c 'printf "\n\n## Notes\n\nSoak overnight.\n" >> /app/data/recipes/zzz-notes-roundtrip-test.md'
curl -s "http://localhost:4321/recipes/zzz-notes-roundtrip-test" | grep -c "Soak overnight."   # expect >=1 (rendered)
python3 - <<'PY'
import json,urllib.request
base="http://localhost:4321/api/recipes"
def get(s): return json.load(urllib.request.urlopen(f"{base}?slug={s}"))
def post(p):
    req=urllib.request.Request(base,data=json.dumps(p).encode(),headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req))
s="zzz-notes-roundtrip-test"; r=get(s)
print("notes read back:", r.get("notes"))
# simulate an editor save (no notes field sent) and confirm notes survive the merge
p={k:r.get(k) for k in ("title","category","description","imageUrl","miseEnPlace","prepTime","cookTime","yieldVal","ingredients","steps")}
p["slug"]=s; p["description"]="Edited desc."
post(p)
print("notes preserved after editor-style save:", "Soak overnight." in (get(s).get("notes") or ""))
PY
```
Expected: `api returns notes field: True`; grep count `>= 1` (Notes rendered on the page); `notes read back:` shows the `## Notes` section; `notes preserved after editor-style save: True`.

- [ ] **Step 5: Delete the test recipe**

Run: `docker compose run --rm -v "$(pwd)/data:/app/data" dev sh -c 'rm -f /app/data/recipes/zzz-notes-roundtrip-test.md'`
Then confirm the homepage lists only the original 4: `curl -s http://localhost:4321/ | grep -oE '/recipes/[a-z0-9-]+' | sort -u | wc -l` → `4`.

---

## Task 6: Update the review-findings doc

**Files:**
- Modify: `docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md`

- [ ] **Step 1: Append an iteration-1 resolution note**

Add a new section at the end:

```markdown
## Iteration 1 review resolution (2026-07-06, plan `2026-07-06-review-iter1-notes-and-fixes.md`)

- `## Notes`/Tips/Origin sections now preserved through render, migration, and editor save (`notes` passthrough). — Resolved.
- `Directions` heading recognized for steps. — Resolved.
- `## info` yield regex anchored (no longer matches "preserve"/"reserve"). — Resolved.
- `recipeBodyMarkdown` reuses `normalizeIngredients`/`normalizeSteps`; detail page extracts once. — Resolved.
- Folder-derived category in API GET — not applicable: GET resolves only flat/structured-by-slug paths, so subfolder recipes 404 and cannot be loaded/edited. Documented limitation.
- Legacy `**Prep**`/`## info` fallbacks — kept (covered by recipeParser tests; deliberately restored).
- `###` ingredient-subgroup preservation — still a non-goal (needs an ingredient-group model; no recipe uses it).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md
git commit -m "docs: record iteration-1 review resolution"
```

---

## Self-Review

- **Coverage:** RB1/RB2 (notes on render+migration+save) → Tasks 1,3,4,5; CO1 (Directions) → Task 1; CO3 (yield anchor) → Task 1; CU1 (dup normalize) → Task 1; CU2 (double parse) → Tasks 2,3. CO2 + CU3 + `###` adjudicated in Task 6. All findings mapped.
- **Placeholders:** none — full code and commands with expected output.
- **Type consistency:** `notes: string` added consistently across `extractRecipe`, `recipeBodyMarkdown`, `serializeRecipe` (via recipe object), `parseRecipe`, and the POST payload; `recipe` object passed to `recipeBodyMarkdown` in Task 3 carries `description`/`ingredients`/`steps`/`notes` from Task 2.
- **No test weakening:** every task adds tests or verifies; existing suites re-run in Tasks 1, 2, 5.
