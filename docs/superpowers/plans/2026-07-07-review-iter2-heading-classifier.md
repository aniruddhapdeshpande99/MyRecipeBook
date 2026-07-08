# Review Iteration 2 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eliminate the section-heading misclassification root cause behind the recurring "content lost" findings by introducing one shared `classifyHeading` used by all body scanners; fix the `Yields` regex; drop the dead `content` field.

**Architecture:** A single `classifyHeading(line)` returns `'ingredients' | 'steps' | 'meta' | 'notes' | 'title' | null`, matching a heading's text exactly (so `## Ingredient Substitutions` is NOT an Ingredients section) and treating single-`#` `# Tips`/`# Notes` as notes. `parseBodySections`, `extractNotes`, and `extractDescription` all consume it, removing three drifting regex copies.

**Tech Stack:** Astro 6 SSR, Node 22, `gray-matter`, Vitest, Docker.

## Global Constraints

- One heading classifier; the three body scanners must not carry their own heading regexes.
- Canonical `## Ingredients` / `## Instructions` and legacy `# Ingredients` / `# Instructions` / `## Directions` / `## info` must still classify correctly; multi-word headings (`## Ingredient Substitutions`, `## Method Notes`) classify as notes (preserved, not phantom ingredients/steps); single-`#` `# Tips`/`# Notes` classify as notes.
- Descriptions and notes preserved verbatim (no `*`/`_` stripping).
- All existing tests must keep passing (recipeParser 8, recipeFormat 19+, ContactForm 4, filterRecipes, slugUtils). Do not weaken tests.
- Tests in Docker: `docker compose run --rm dev npx vitest run <files>`.
- Commits: NO Claude authorship / NO `Co-Authored-By`. Branch `fix/recipe-canonical-format`.

---

## Task 1: Shared classifyHeading + rewire body scanners + Yields fix

**Files:**
- Modify: `src/utils/recipeFormat.js`
- Test: `src/utils/recipeFormat.test.js`

**Interfaces:**
- Produces: private `classifyHeading(line) => 'ingredients'|'steps'|'meta'|'notes'|'title'|null`, used internally; `extractRecipe`/`recipeBodyMarkdown` external contract unchanged (still return/consume `ingredients`, `steps`, `notes`).

- [ ] **Step 1: Write failing tests**

Append to `src/utils/recipeFormat.test.js`:

```js
describe('heading classification precision', () => {
  it('treats a multi-word "## Ingredient Substitutions" as notes, not ingredients', () => {
    const raw = `---
title: X
---
D.

## Ingredients
- **2** Beans

## Ingredient Substitutions
- Use almond milk instead of milk
`;
    const r = extractRecipe(raw);
    expect(r.ingredients).toEqual([{ proportion: '2', item: 'Beans' }]); // no phantom entry
    expect(r.notes).toContain('## Ingredient Substitutions');
    expect(r.notes).toContain('Use almond milk instead of milk');
  });

  it('captures a legacy single-# "# Tips" section as notes', () => {
    const raw = `---
title: X
---
D.

# Ingredients
- Beans

# Tips

Soak overnight.
`;
    const r = extractRecipe(raw);
    expect(r.ingredients).toEqual([{ item: 'Beans', proportion: '' }]);
    expect(r.notes).toBe('# Tips\n\nSoak overnight.');
  });

  it('## info yield matches plural "Yields 6"', () => {
    const raw = `---
title: X
---
D.

## info
- Yields 6

## Ingredients
- Beans
`;
    expect(extractRecipe(raw).yieldVal).toBe('Yields 6');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js`
Expected: FAIL — phantom ingredient added / `# Tips` dropped / `Yields 6` not matched.

- [ ] **Step 3: Implement**

In `src/utils/recipeFormat.js`:

(a) Add the shared classifier (place it just above `parseBodySections`):

```js
function classifyHeading(line) {
  const m = String(line).trim().match(/^(#{1,2})\s+(.+?)\s*:?\s*$/);
  if (!m) return null;
  const text = m[2].trim().toLowerCase();
  if (/^ingredients?$/.test(text)) return 'ingredients';
  if (/^(instructions?|steps?|methods?|directions?)$/.test(text)) return 'steps';
  if (/^info$/.test(text)) return 'meta';
  if (/^(notes?|tips?|origins?)$/.test(text) || /^based on\b/.test(text)) return 'notes';
  return m[1] === '##' ? 'notes' : 'title';
}
```

(b) Replace `parseBodySections` with the classifier-driven version:

```js
function parseBodySections(content) {
  const ingredients = [];
  const steps = [];
  let section = null;
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    const kind = classifyHeading(t);
    if (kind) { section = (kind === 'ingredients' || kind === 'steps') ? kind : null; continue; }
    if (section === 'ingredients' && (t.startsWith('- ') || t.startsWith('* '))) {
      const itemStr = t.replace(/^[-*]\s*/, '').trim();
      const m = itemStr.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (m) ingredients.push({ proportion: m[1].trim(), item: m[2].trim() });
      else ingredients.push({ item: itemStr, proportion: '' });
    } else if (section === 'steps' && /^\d+\.\s+/.test(t)) {
      steps.push(t.replace(/^\d+\.\s*/, '').trim());
    } else if (section === 'steps' && (t.startsWith('- ') || t.startsWith('* '))) {
      steps.push(t.replace(/^[-*]\s*/, '').trim());
    }
  }
  return { ingredients, steps };
}
```

(c) Replace `extractNotes` with the classifier-driven version:

```js
function extractNotes(content) {
  const out = [];
  let capturing = false;
  for (const raw of content.split(/\r?\n/)) {
    const kind = classifyHeading(raw);
    if (kind) {
      capturing = kind === 'notes';
      if (capturing) out.push(raw);
      continue;
    }
    if (capturing) out.push(raw);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
```

(d) Replace `extractDescription` with the classifier-driven version:

```js
function extractDescription(content, title) {
  const collected = [];
  for (const raw of content.split(/\r?\n/)) {
    const kind = classifyHeading(raw);
    if (kind === 'ingredients' || kind === 'steps' || kind === 'notes' || kind === 'meta') break;
    if (kind === 'title') continue;
    const line = raw.trim();
    if (line.startsWith('**Prep') || line.startsWith('**Cook') || line.startsWith('**Yield')) continue;
    if (line.startsWith('---')) continue;
    collected.push(raw);
  }
  const desc = collected.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return desc || `A delicious recipe for ${title || 'this dish'}.`;
}
```

(e) Add `yields?` to the `## info` yield regex (the `else if` in `extractRecipe`):

```js
        } else if (/\b(serves?|servings?|yields?|makes)\b/i.test(text)) {
```

- [ ] **Step 4: Run to verify pass**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js src/utils/recipeParser.test.js`
Expected: PASS — new tests plus all existing recipeFormat and recipeParser tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeFormat.test.js
git commit -m "fix: unify section-heading classification (precise; single-# notes; Yields)"
```

---

## Task 2: Remove the dead `content` field

**Files:**
- Modify: `src/utils/recipeFormat.js`, `src/utils/recipeParser.js`

**Interfaces:** `extractRecipe`/`parseRecipe` return objects no longer include `content` (verified: no reader in `src/pages`, `src/components`, `src/layouts`).

- [ ] **Step 1: Confirm no reader and no test depends on it**

Run: `grep -rnE "\.content\b" src/ | grep -viE "textContent|innerHTML|contentType|contentFor"`
Expected: no line referencing a recipe object's `.content`. (If any test asserts `.content`, STOP — do not remove.)

- [ ] **Step 2: Remove `content` from `extractRecipe`'s return**

In `src/utils/recipeFormat.js`, delete the `content,` line from the object `extractRecipe` returns (the last field before the closing `};`). Leave the local `const content = parsed.content || '';` in place (still used by `extractDescription`/`parseBodySections`/`extractNotes` calls).

- [ ] **Step 3: Remove `content` from `parseRecipe`'s return**

In `src/utils/recipeParser.js`, delete the `content: r.content,` line from the returned object.

- [ ] **Step 4: Verify tests + build**

Run: `docker compose run --rm dev npx vitest run src/utils/recipeFormat.test.js src/utils/recipeParser.test.js`
Expected: PASS (no test depended on `content`).
Run: `docker compose run --rm dev npm run build`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/recipeFormat.js src/utils/recipeParser.js
git commit -m "cleanup: drop unused content field from recipe reads"
```

---

## Task 3: Full suite, re-migrate, redeploy, verify, and adjudicate remaining findings

**Files:**
- Modify: `docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md`

- [ ] **Step 1: Full suite green**

Run: `docker compose run --rm dev npm run test:run`
Expected: 5 files passed, 0 failed.

- [ ] **Step 2: Idempotent re-migration**

Run: `docker compose run --rm -v "$(pwd)/scripts:/app/scripts" dev node scripts/migrate-recipes.mjs`
Expected: `unchanged:` for all 4 files.

- [ ] **Step 3: Rebuild + restart + wait ready**

Run: `docker compose build && docker compose up -d`
Then: `for i in $(seq 1 20); do curl -sf http://localhost:4321/ -o /dev/null && break; sleep 3; done`

- [ ] **Step 4: Live re-verify both original bugs still fixed + a multi-word-heading recipe**

Run:
```bash
curl -s http://localhost:4321/recipes/rajma-ranveer-brar-style | grep -c "Chop your 1.5 large onions"   # expect 1
curl -s "http://localhost:4321/api/recipes?slug=rajma-ranveer-brar-style" | python3 -c "import sys,json;print('Bonus:', 'Bonus - Spiced Lemon Onion Salad' in json.load(sys.stdin)['description'])"
curl -s http://localhost:4321/ | grep -oE '/recipes/[a-z0-9-]+' | sort -u | wc -l   # expect 4
```
Expected: `1`; `Bonus: True`; `4`.

- [ ] **Step 5: Record adjudications in the findings doc**

Append this section to `docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md`:

```markdown
## Iteration 2 review resolution (2026-07-07, plan `2026-07-07-review-iter2-heading-classifier.md`)

- Root cause of recurring notes/section-loss: three drifting heading regexes. Fixed by one shared `classifyHeading`; `## Ingredient Substitutions`/`## Method Notes` now classify as notes (not phantom ingredients/steps), and single-`#` `# Tips`/`# Notes` are captured. — Resolved.
- `## info` yield regex now matches plural "Yields". — Resolved.
- Dead `content` field removed from recipe reads. — Resolved.
- Notes reordered to end of body on save/migration — accepted: the canonical body order is description → ingredients → instructions → notes; content is preserved, only position is normalized.
- POST notes-read swallows errors → wipe on malformed YAML — accepted as unreachable: the app only writes valid YAML via `matter.stringify`, and a malformed file already 404s on GET (cannot be loaded to edit).
- Folder-derived category in API GET — accepted limitation: GET resolves only flat/structured-by-slug paths, so subfolder recipes 404 and cannot be loaded/edited.
- Editor has no Notes UI — accepted: product gap, not a regression. Notes authored in the markdown file survive edits; a Notes editor field is future work.
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-05-recipe-canonical-format-review-findings.md
git commit -m "docs: record iteration-2 review resolution and adjudications"
```

---

## Self-Review

- **Coverage:** CO2-1 (multi-word heading) + CL2-1 (single-# notes) + CL2-4 (regex drift) → Task 1 (shared classifier); CO2-2 (Yields) → Task 1; CL2-5 (dead content) → Task 2; CO2-3/CO2-4/CL2-3/CL2-6 adjudicated → Task 3.
- **Placeholders:** none — full code and commands with expected output.
- **Type consistency:** `classifyHeading` return union used identically in all three scanners; `extractRecipe`/`recipeBodyMarkdown` external shape unchanged except the intentional `content` removal (Task 2), which has no readers.
- **Regression guard:** Task 1 Step 4 and Task 2 Step 4 re-run the full recipeFormat + recipeParser suites; Task 3 re-runs the whole suite and re-verifies both original bugs live.
