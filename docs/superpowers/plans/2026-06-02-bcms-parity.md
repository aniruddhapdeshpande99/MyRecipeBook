# Sven's Cookbook — BCMS Reference Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining BCMS starters reference features and ship a Docker image for mobile testing.

**Architecture:** Astro 6 SSR app — recipes are markdown files, no database. New utilities are pure TypeScript functions tested with Vitest. New interactive UI is Astro with inline vanilla JS, except `ContactForm` which is a React component to enable @testing-library testing. All new CSS is appended to `global.css` (never touching existing rules). Docker multi-stage build bakes `public/` into `dist/client/` at build time.

**Tech Stack:** Astro 6.4.2, Node SSR adapter (standalone), React 18, Tailwind v4 (vite plugin), Vitest 4 + jsdom + @testing-library/react, gray-matter, docker + docker-compose

**Working directory:** `/mnt/d/Antigravity_Projects/Personal Recipe Collection App`

**Test runner:** `npx vitest run <file>` from project root

---

## Parallel Execution Map

Tasks in the same Wave share **no files** and can be dispatched simultaneously.

| Wave | Tasks | Constraint |
|------|-------|-----------|
| Pre-flight | Commit unstaged work | Sequential — must be first |
| **Wave A** | A1 A2 A3 A4 A5 A6 A7 | All new files — fully parallel |
| **Wave B** | B1 | Sequential — sole owner of global.css |
| **Wave C** | C1 + C2 | Parallel — different files, no CSS needed |
| **Wave D** | D1 + D2 | Parallel — depends on Wave A (components) + Wave B (CSS) |
| Final | Tests → Build → Docker → Push | Sequential |

---

## File Map

**New files:**
- `src/utils/filterRecipes.ts` — pure filter: text query + category
- `src/utils/filterRecipes.test.ts` — Vitest tests
- `src/utils/slugUtils.ts` — slug sanitisation shared by download endpoint
- `src/utils/slugUtils.test.ts` — Vitest tests
- `src/pages/api/download.ts` — `GET /api/download?slug=` → attachment download
- `src/pages/api/suggest.ts` — `POST /api/suggest` → appends to `data/suggestions.log`
- `src/components/ContactForm.jsx` — React form (fetch POST to /api/suggest)
- `src/components/ContactForm.test.jsx` — @testing-library tests
- `src/components/Footer.astro` — static footer
- `src/components/AboutSection.astro` — static about + stats
- `src/components/ContactSection.astro` — section wrapper mounting `<ContactForm client:load />`
- `src/pages/404.astro` — custom 404
- `src/pages/legal.astro` — legal/privacy page

**Modified files:**
- `src/styles/global.css` — append 11 CSS blocks (no edits to existing rules)
- `src/layouts/Layout.astro` — import Footer, add 2 nav links
- `src/pages/index.astro` — hero search + CTA, filter bar, card thumbnails, download btns, sections
- `src/pages/recipes/[...slug].astro` — prev/next step navigation
- `src/pages/api/recipes.ts` — fix flat-readdir bug in GET
- `src/utils/recipeParser.test.js` — append 2 new test cases

---

## Pre-flight: Commit Unstaged Work

- [ ] **Step 1: Stage and commit everything already in-progress**

```bash
cd "/mnt/d/Antigravity_Projects/Personal Recipe Collection App"
git add CLAUDE.md \
  public/images/hero-banner.jpg \
  astro.config.mjs package.json package-lock.json \
  public/apple-touch-icon.png \
  src/components/RecipeEditor.jsx \
  src/layouts/Layout.astro \
  src/pages/index.astro \
  "src/pages/recipes/[...slug].astro" \
  src/styles/global.css
git commit -m "chore: baseline — Tailwind v4, premium header, hero banner, SSR recipe detail"
```

Expected: 1 commit created, `git status` shows clean working tree.

---

## Wave A — New Files (Fully Parallel)

### Task A1: filterRecipes utility

**Files:**
- Create: `src/utils/filterRecipes.ts`
- Create: `src/utils/filterRecipes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/filterRecipes.test.ts
import { describe, it, expect } from 'vitest';
import { filterRecipes } from './filterRecipes';

const RECIPES = [
  { title: 'Shahi Kaju Paneer', category: 'Mains', description: 'rich cashew dish', slug: 'shahi', prepTime: '20 min', cookTime: '40 min', yieldVal: '4 servings' },
  { title: 'Mushroom Bagel', category: 'Sandwiches', description: 'creamy mushroom', slug: 'bagel', prepTime: '10 min', cookTime: '5 min', yieldVal: '2' },
  { title: 'Chocolate Cake', category: 'Desserts', description: 'rich chocolate dessert', slug: 'cake', prepTime: '15 min', cookTime: '45 min', yieldVal: '8 servings' },
];

describe('filterRecipes', () => {
  it('returns all recipes when no options given', () => {
    expect(filterRecipes(RECIPES, {})).toHaveLength(3);
  });

  it('filters by title case-insensitively', () => {
    const result = filterRecipes(RECIPES, { query: 'mushroom' });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('bagel');
  });

  it('filters by description', () => {
    const result = filterRecipes(RECIPES, { query: 'cashew' });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('shahi');
  });

  it('filters by exact category', () => {
    const result = filterRecipes(RECIPES, { category: 'Desserts' });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('cake');
  });

  it('applies query AND category together', () => {
    const result = filterRecipes(RECIPES, { query: 'rich', category: 'Desserts' });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('cake');
  });

  it('returns empty array when nothing matches', () => {
    expect(filterRecipes(RECIPES, { query: 'nonexistent' })).toHaveLength(0);
  });

  it('treats category ALL as no filter', () => {
    expect(filterRecipes(RECIPES, { category: 'ALL' })).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test — verify it FAILS**

```bash
npx vitest run src/utils/filterRecipes.test.ts
```

Expected failure: `Error: Failed to resolve import "./filterRecipes"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/filterRecipes.ts
export interface RecipeMeta {
  title: string;
  category: string;
  slug: string;
  description: string;
  prepTime: string;
  cookTime: string;
  yieldVal: string;
}

export interface FilterOptions {
  query?: string;
  category?: string;
}

export function filterRecipes(recipes: RecipeMeta[], opts: FilterOptions): RecipeMeta[] {
  const q = (opts.query || '').toLowerCase().trim();
  const cat = opts.category && opts.category !== 'ALL' ? opts.category : null;
  return recipes.filter((r) => {
    const matchesQuery = !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    const matchesCat = !cat || r.category === cat;
    return matchesQuery && matchesCat;
  });
}
```

- [ ] **Step 4: Run test — verify it PASSES**

```bash
npx vitest run src/utils/filterRecipes.test.ts
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/filterRecipes.ts src/utils/filterRecipes.test.ts
git commit -m "feat: filterRecipes utility with TDD — query + category AND filter"
```

---

### Task A2: slugUtils + download API

**Files:**
- Create: `src/utils/slugUtils.ts`
- Create: `src/utils/slugUtils.test.ts`
- Create: `src/pages/api/download.ts`

- [ ] **Step 1: Write failing tests for slugUtils**

```typescript
// src/utils/slugUtils.test.ts
import { describe, it, expect } from 'vitest';
import { sanitiseSlug } from './slugUtils';

describe('sanitiseSlug', () => {
  it('passes a normal slug through unchanged (lowercased)', () => {
    expect(sanitiseSlug('shahi-kaju-paneer-gravy')).toBe('shahi-kaju-paneer-gravy');
  });

  it('lowercases uppercase slugs', () => {
    expect(sanitiseSlug('SomeRecipe')).toBe('somerecipe');
  });

  it('strips path-traversal characters', () => {
    expect(sanitiseSlug('../etc/passwd')).toBe('etcpasswd');
  });

  it('strips slashes', () => {
    expect(sanitiseSlug('some/nested/path')).toBe('somenestedpath');
  });

  it('returns empty string for empty input', () => {
    expect(sanitiseSlug('')).toBe('');
  });

  it('keeps underscores and hyphens', () => {
    expect(sanitiseSlug('my_recipe-name')).toBe('my_recipe-name');
  });
});
```

- [ ] **Step 2: Run — verify FAILS**

```bash
npx vitest run src/utils/slugUtils.test.ts
```

Expected: `Error: Failed to resolve import "./slugUtils"`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/slugUtils.ts
export function sanitiseSlug(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}
```

- [ ] **Step 4: Run — verify PASSES**

```bash
npx vitest run src/utils/slugUtils.test.ts
```

Expected: `6 passed`

- [ ] **Step 5: Write download API endpoint**

```typescript
// src/pages/api/download.ts
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { sanitiseSlug } from '../../utils/slugUtils';

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get('slug') || '';
  const slug = sanitiseSlug(rawSlug);

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Invalid slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filePath = path.join(process.cwd(), 'data', 'recipes', `${slug}.md`);

  if (!fsSync.existsSync(filePath)) {
    return new Response(JSON.stringify({ error: 'Recipe not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.md"`,
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/slugUtils.ts src/utils/slugUtils.test.ts src/pages/api/download.ts
git commit -m "feat: slugUtils + download API with TDD — GET /api/download?slug= returns attachment"
```

---

### Task A3: suggest API

**Files:**
- Create: `src/pages/api/suggest.ts`

No unit test — this endpoint performs only file I/O with no logic worth isolating. Its behavior is verified in the Final smoke-test step.

- [ ] **Step 1: Write the endpoint**

```typescript
// src/pages/api/suggest.ts
import fs from 'node:fs/promises';
import path from 'node:path';

export async function POST({ request }: { request: Request }) {
  let body: { name?: string; email?: string; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name = '', email = '', message = '' } = body;
  if (!name.trim() || !email.trim() || !message.trim()) {
    return new Response(JSON.stringify({ error: 'All fields required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  const entry = `\n--- ${new Date().toISOString()} ---\nFrom: ${name} <${email}>\n${message}\n`;
  await fs.appendFile(path.join(dataDir, 'suggestions.log'), entry, 'utf-8');

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/suggest.ts
git commit -m "feat: POST /api/suggest — appends suggestions to data/suggestions.log"
```

---

### Task A4: ContactForm React component

**Files:**
- Create: `src/components/ContactForm.jsx`
- Create: `src/components/ContactForm.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/ContactForm.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactForm from './ContactForm';

describe('ContactForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders name, email, message fields and submit button', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe suggestion/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send suggestion/i })).toBeInTheDocument();
  });

  it('shows success message after successful POST', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/recipe suggestion/i), { target: { value: 'Biryani' } });
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }));
    await waitFor(() => expect(screen.getByText(/thanks! suggestion received/i)).toBeInTheDocument());
  });

  it('shows error message when POST fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bob@example.com' } });
    fireEvent.change(screen.getByLabelText(/recipe suggestion/i), { target: { value: 'Tacos' } });
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
  });

  it('disables submit button while submitting', async () => {
    let resolvePromise;
    global.fetch.mockReturnValueOnce(new Promise((r) => { resolvePromise = r; }));
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Carol' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'carol@example.com' } });
    fireEvent.change(screen.getByLabelText(/recipe suggestion/i), { target: { value: 'Pasta' } });
    fireEvent.click(screen.getByRole('button', { name: /send suggestion/i }));
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    resolvePromise({ ok: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /send suggestion/i })).not.toBeDisabled());
  });
});
```

- [ ] **Step 2: Run — verify FAILS**

```bash
npx vitest run src/components/ContactForm.test.jsx
```

Expected: `Error: Failed to resolve import "./ContactForm"`

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/components/ContactForm.jsx
import React, { useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { text, isError }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setFeedback({ text: 'Thanks! Suggestion received.', isError: false });
        setName(''); setEmail(''); setMessage('');
      } else {
        setFeedback({ text: 'Something went wrong. Please try again.', isError: true });
      }
    } catch {
      setFeedback({ text: 'Something went wrong. Please try again.', isError: true });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form className="suggest-form" onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label htmlFor="suggest-name">Your Name</label>
        <input
          id="suggest-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Maria"
        />
      </div>
      <div className="form-group">
        <label htmlFor="suggest-email">Email</label>
        <input
          id="suggest-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="form-group">
        <label htmlFor="suggest-message">Recipe Suggestion</label>
        <textarea
          id="suggest-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the recipe or paste a link…"
          rows={4}
        />
      </div>
      {feedback && (
        <div
          className="save-message"
          style={
            feedback.isError
              ? { backgroundColor: 'rgba(140,59,26,0.1)', color: 'var(--color-terracotta)', borderColor: 'rgba(140,59,26,0.2)' }
              : {}
          }
        >
          {feedback.text}
        </div>
      )}
      <button type="submit" className="save-btn" disabled={isSending}>
        {isSending ? 'Sending…' : 'Send Suggestion'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run — verify PASSES**

```bash
npx vitest run src/components/ContactForm.test.jsx
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/ContactForm.jsx src/components/ContactForm.test.jsx
git commit -m "feat: ContactForm React component with TDD — POST /api/suggest, success/error states"
```

---

### Task A5: Static Astro components (Footer, AboutSection, ContactSection)

No unit tests — these are pure HTML with no logic. Behavior verified by browser smoke test.

**Files:**
- Create: `src/components/Footer.astro`
- Create: `src/components/AboutSection.astro`
- Create: `src/components/ContactSection.astro`

- [ ] **Step 1: Create Footer.astro**

```astro
---
// src/components/Footer.astro
---
<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true" style="width:28px;height:28px;color:var(--color-sage-light)">
        <line x1="34" y1="6" x2="34" y2="38" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <ellipse cx="34" cy="10" rx="4" ry="5.5" stroke="currentColor" stroke-width="2.2" fill="none"/>
        <line x1="26" y1="6" x2="26" y2="38" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M26 6 Q20 14 22 22 L26 22" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 38 Q14 28 18 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <ellipse cx="12" cy="26" rx="4" ry="2.5" transform="rotate(-30 12 26)" fill="currentColor" opacity="0.7"/>
        <ellipse cx="20" cy="22" rx="4" ry="2.5" transform="rotate(20 20 22)" fill="currentColor" opacity="0.7"/>
      </svg>
      <span class="site-footer__name">Sven's Cookbook</span>
      <p class="site-footer__tagline">A personal collection of recipes, crafted with care.</p>
    </div>
    <nav class="site-footer__nav" aria-label="Footer navigation">
      <a href="/">Recipes</a>
      <a href="/editor">+ Add Recipe</a>
      <a href="/#about">About</a>
      <a href="/#contact">Suggest a Recipe</a>
      <a href="/legal">Legal</a>
    </nav>
    <p class="site-footer__copy">
      &copy; <span id="footer-year"></span> Sven's Cookbook. All rights reserved.
    </p>
  </div>
</footer>
<script>
  const el = document.getElementById('footer-year');
  if (el) el.textContent = String(new Date().getFullYear());
</script>
```

- [ ] **Step 2: Create AboutSection.astro**

```astro
---
// src/components/AboutSection.astro
---
<section id="about" class="about-section">
  <div class="about-section__bg" aria-hidden="true"></div>
  <div class="about-section__inner">
    <div class="about-section__text">
      <h2 class="about-section__title">Built for the Kitchen, Not the Algorithm</h2>
      <p class="about-section__desc">
        Sven's Cookbook is a private recipe collection — no ads, no tracking, no "jump to recipe" buttons.
        Just food, instructions, and a love for cooking.
      </p>
    </div>
    <div class="about-section__stats">
      <div class="stat-item">
        <span class="stat-value">50+</span>
        <span class="stat-label">Recipes</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">15+</span>
        <span class="stat-label">Years Cooking</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">8</span>
        <span class="stat-label">Cuisines</span>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Create ContactSection.astro**

```astro
---
// src/components/ContactSection.astro
import ContactForm from './ContactForm.jsx';
---
<section id="contact" class="contact-section">
  <div class="contact-section__inner">
    <h2 class="contact-section__title">Suggest a Recipe</h2>
    <p class="contact-section__desc">Have a recipe you'd like to see here? Drop it below.</p>
    <ContactForm client:load />
  </div>
</section>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Footer.astro src/components/AboutSection.astro src/components/ContactSection.astro
git commit -m "feat: Footer, AboutSection, ContactSection Astro components"
```

---

### Task A6: 404 and Legal pages

**Files:**
- Create: `src/pages/404.astro`
- Create: `src/pages/legal.astro`

- [ ] **Step 1: Create 404.astro**

```astro
---
// src/pages/404.astro
import Layout from '../layouts/Layout.astro';
---
<Layout title="Page Not Found">
  <main class="not-found-page">
    <div class="not-found-inner">
      <span class="not-found-emoji" aria-hidden="true">🍳</span>
      <h1 class="not-found-title">Recipe Not Found</h1>
      <p class="not-found-desc">This page doesn't exist — maybe the recipe got eaten.</p>
      <a href="/" class="action-btn" style="margin-top:1rem">← Back to the Cookbook</a>
    </div>
  </main>
</Layout>
```

- [ ] **Step 2: Create legal.astro**

```astro
---
// src/pages/legal.astro
import Layout from '../layouts/Layout.astro';
---
<Layout title="Legal" description="Privacy policy and terms of use for Sven's Cookbook.">
  <main>
    <div class="legal-page">
      <h1>Legal</h1>
      <h2>Privacy</h2>
      <p>This is a private, personal recipe collection. No data is collected, no cookies are set, and no analytics are run.</p>
      <h2>Content</h2>
      <p>All recipes are personal notes. External recipe sources are credited where applicable.</p>
      <p><a href="/">← Back to the Cookbook</a></p>
    </div>
  </main>
</Layout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/404.astro src/pages/legal.astro
git commit -m "feat: custom 404 page and legal page"
```

---

### Task A7: Extend recipeParser tests

**Files:**
- Modify: `src/utils/recipeParser.test.js` (append 2 cases inside the existing `describe` block)

- [ ] **Step 1: Run existing tests — verify they PASS first**

```bash
npx vitest run src/utils/recipeParser.test.js
```

Expected: `4 passed`

- [ ] **Step 2: Append the 2 new test cases inside the existing `describe('recipeParser', () => {` block, before the closing `});`**

```js
  it('derives slug correctly from hyphenated filename with mixed case', () => {
    const result = parseRecipe(
      'data/recipes/Desi-Italian-Creamy-Mushroom-Bagel.md',
      '# Desi Italian Creamy Mushroom Bagel'
    );
    expect(result.slug).toBe('desi-italian-creamy-mushroom-bagel');
  });

  it('assigns General category to flat recipes not in a subdirectory', () => {
    const result = parseRecipe('data/recipes/some-recipe.md', '# Some Recipe');
    expect(result.category).toBe('General');
  });
```

- [ ] **Step 3: Run — verify 6 pass**

```bash
npx vitest run src/utils/recipeParser.test.js
```

Expected: `6 passed`

- [ ] **Step 4: Commit**

```bash
git add src/utils/recipeParser.test.js
git commit -m "test: add slug + General-category edge cases to recipeParser"
```

---

## Wave B — CSS Additions (Sequential, sole owner of global.css)

### Task B1: Append all new CSS to global.css

**Files:**
- Modify: `src/styles/global.css` (append only — do not touch any existing rules)

- [ ] **Step 1: Append the following blocks at the END of the file**

Append exactly this content after the last line (`}` closing `.save-message`):

```css
/* ============================================================
   RECIPE CARD — THUMBNAIL IMAGE
   ============================================================ */
.recipe-card__thumb {
  width: 100%;
  height: 160px;
  object-fit: cover;
  object-position: center;
  display: block;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  background-color: var(--color-cream-dark);
}
.recipe-card__thumb-placeholder {
  width: 100%;
  height: 160px;
  background: linear-gradient(135deg, var(--color-sage-mist) 0%, var(--color-cream-dark) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
}
@media (prefers-color-scheme: dark) {
  .recipe-card__thumb-placeholder {
    background: linear-gradient(135deg, var(--color-dark-border) 0%, var(--color-dark-surface) 100%);
  }
}

/* ============================================================
   RECIPE CARD — DOWNLOAD BUTTON
   ============================================================ */
.recipe-card__download {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  font-family: var(--font-sans);
  color: var(--color-sage);
  background-color: var(--color-sage-mist);
  border: 1px solid rgba(62,86,67,0.2);
  border-radius: var(--radius-pill);
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.2s ease;
  cursor: pointer;
  align-self: flex-start;
  margin-top: 0.5rem;
}
.recipe-card__download:hover { background-color: var(--color-sage); color: var(--color-cream); }
.recipe-card__download svg { width: 12px; height: 12px; }
@media (prefers-color-scheme: dark) {
  .recipe-card__download {
    color: var(--color-dark-text);
    background-color: rgba(255,255,255,0.05);
    border-color: var(--color-dark-border);
  }
}

/* ============================================================
   HERO BANNER — CTA + EMBEDDED SEARCH
   ============================================================ */
.hero-banner__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding: 0.7rem 1.6rem;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-sage);
  background-color: var(--color-cream);
  border-radius: var(--radius-pill);
  text-decoration: none;
  transition: background-color 0.2s ease, transform 0.2s ease;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}
.hero-banner__cta:hover { background-color: var(--color-cream-dark); color: var(--color-sage-dark); transform: translateY(-2px); }
.hero-search { position: relative; width: 100%; max-width: 480px; margin-top: 1rem; }
.hero-search__input {
  width: 100%;
  padding: 0.85rem 1.25rem 0.85rem 3rem;
  font-size: 0.95rem;
  font-family: var(--font-sans);
  background-color: rgba(255,255,255,0.92);
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-ink);
  outline: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.18);
  backdrop-filter: blur(4px);
  transition: background-color 0.2s ease;
}
.hero-search__input:focus { background-color: rgba(255,255,255,1); }
.hero-search__input::placeholder { color: var(--color-muted); }
.hero-search__icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--color-muted);
  pointer-events: none;
}

/* ============================================================
   FILTERS BAR
   ============================================================ */
.filters-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 1.5rem 0 0;
}
.filter-select {
  padding: 0.6rem 2rem 0.6rem 0.9rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  background-color: var(--color-cream-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-ink-soft);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235C6B5F' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
  background-size: 16px;
  transition: border-color 0.2s ease;
}
.filter-select:focus { outline: none; border-color: var(--color-sage); }
@media (prefers-color-scheme: dark) {
  .filter-select { background-color: var(--color-dark-surface); border-color: var(--color-dark-border); color: var(--color-dark-text); }
}
.filter-clear {
  font-size: 0.78rem;
  color: var(--color-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-family: var(--font-sans);
  transition: color 0.2s ease;
}
.filter-clear:hover { color: var(--color-terracotta); }

/* ============================================================
   COOKING MODE — PREV/NEXT STEP NAVIGATION
   ============================================================ */
.step-nav {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-sage-mist);
  border-radius: 8px;
}
.cooking-mode-active .step-nav { display: flex; }
.step-nav__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-sage);
  background-color: var(--color-cream-surface);
  border: 1.5px solid var(--color-sage);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.step-nav__btn:hover:not(:disabled) { background-color: var(--color-sage); color: var(--color-cream); }
.step-nav__btn:disabled { opacity: 0.35; cursor: not-allowed; border-color: var(--color-border); color: var(--color-muted); }
.step-nav__indicator { font-family: var(--font-sans); font-size: 0.8rem; font-weight: 600; color: var(--color-sage); }

/* ============================================================
   SITE FOOTER
   ============================================================ */
.site-footer { background-color: var(--color-sage); color: var(--color-cream); padding: 2.5rem 2rem 1.75rem; margin-top: 4rem; }
.site-footer__inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 1rem 2rem;
  align-items: start;
}
.site-footer__brand { display: flex; flex-direction: column; gap: 0.4rem; }
.site-footer__name { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 600; color: var(--color-cream); }
.site-footer__tagline { font-size: 0.8rem; color: rgba(244,243,239,0.65); font-style: italic; margin: 0; }
.site-footer__nav { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end; }
.site-footer__nav a { font-size: 0.85rem; color: rgba(244,243,239,0.75); text-decoration: none; transition: color 0.2s ease; }
.site-footer__nav a:hover { color: var(--color-cream); }
.site-footer__copy { grid-column: 1 / -1; font-size: 0.72rem; color: rgba(244,243,239,0.45); margin: 0.75rem 0 0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.75rem; }
@media (max-width: 600px) {
  .site-footer__inner { grid-template-columns: 1fr; }
  .site-footer__nav { align-items: flex-start; flex-direction: row; flex-wrap: wrap; }
}

/* ============================================================
   ABOUT SECTION
   ============================================================ */
.about-section { position: relative; margin-top: 4rem; border-radius: 16px; overflow: hidden; background-color: var(--color-sage); }
.about-section__bg { position: absolute; inset: 0; background: linear-gradient(135deg, var(--color-sage-dark) 0%, var(--color-sage) 60%, var(--color-sage-light) 100%); opacity: 0.55; }
.about-section__inner { position: relative; z-index: 1; padding: 3rem 2rem; display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: center; }
@media (max-width: 768px) { .about-section__inner { grid-template-columns: 1fr; } }
.about-section__title { font-family: var(--font-serif); font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 600; color: var(--color-cream); margin-bottom: 0.75rem; }
.about-section__desc { font-size: 0.95rem; color: rgba(244,243,239,0.8); line-height: 1.65; margin: 0; }
.about-section__stats { display: flex; gap: 2rem; }
@media (max-width: 480px) { .about-section__stats { gap: 1.25rem; } }
.stat-item { display: flex; flex-direction: column; align-items: center; text-align: center; }
.stat-value { font-family: var(--font-serif); font-size: 2rem; font-weight: 600; color: var(--color-cream); line-height: 1; }
.stat-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-sage-light); margin-top: 0.3rem; }

/* ============================================================
   CONTACT SECTION
   ============================================================ */
.contact-section { margin-top: 4rem; }
.contact-section__inner { max-width: 600px; margin: 0 auto; text-align: center; }
.contact-section__title { font-family: var(--font-serif); font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 600; color: var(--color-ink); margin-bottom: 0.5rem; }
@media (prefers-color-scheme: dark) { .contact-section__title { color: var(--color-dark-text); } }
.contact-section__desc { font-size: 0.95rem; color: var(--color-muted); margin-bottom: 2rem; }
.suggest-form { text-align: left; }

/* ============================================================
   404 PAGE
   ============================================================ */
.not-found-page { display: flex; align-items: center; justify-content: center; min-height: 60vh; text-align: center; }
.not-found-inner { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.not-found-emoji { font-size: 4rem; }
.not-found-title { font-family: var(--font-serif); font-size: 2rem; color: var(--color-ink); }
.not-found-desc { color: var(--color-muted); font-size: 1rem; margin: 0; }

/* ============================================================
   LEGAL PAGE
   ============================================================ */
.legal-page { max-width: 700px; margin: 3rem auto; }
.legal-page h1 { font-family: var(--font-serif); font-size: 2rem; margin-bottom: 1.5rem; }
.legal-page h2 { font-family: var(--font-serif); font-size: 1.3rem; margin: 1.5rem 0 0.5rem; }
.legal-page p { color: var(--color-muted); line-height: 1.7; margin: 0 0 0.75rem; }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "style: append 11 new CSS blocks — card thumbs, hero search, filters, step-nav, footer, about, contact, 404, legal"
```

---

## Wave C — Modify Existing Utility Files (Parallel)

### Task C1: Fix api/recipes.ts GET handler

**Files:**
- Modify: `src/pages/api/recipes.ts`

**Bug:** The current GET handler uses flat `fs.readdir()` which misses recipes in subdirectories (e.g. `data/recipes/Mains/recipe.md`). `index.astro` uses a recursive walk — this endpoint should match.

- [ ] **Step 1: Replace the GET function entirely**

The entire `GET` export in `src/pages/api/recipes.ts` should become:

```typescript
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export async function GET({ request }: { request: Request }) {
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (slug) {
    const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(dataDir, `${safeSlug}.md`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(raw);
      return new Response(
        JSON.stringify({ slug: safeSlug, ...parsed.data, content: parsed.content }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
  }

  async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = await Promise.all(entries.map(async (e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    }));
    return results.flat().filter((f) => f.endsWith('.md'));
  }

  const files = await walk(dataDir);
  const recipes = await Promise.all(files.map(async (fp) => {
    const raw = await fs.readFile(fp, 'utf-8');
    const parsed = matter(raw);
    return { slug: path.basename(fp, '.md'), ...parsed.data, content: parsed.content };
  }));

  return new Response(JSON.stringify(recipes), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: { request: Request }) {
  const data = await request.json();
  const { slug, title, category, ingredients, steps, description, prepTime, cookTime, yieldVal } = data;
  const safeSlug = slug ? slug.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  const safeTitle = title
    ? title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    : 'untitled';
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });
  const fileContent = matter.stringify(description || '', {
    title, category, prepTime, cookTime, yieldVal, ingredients, steps,
  });
  const filename = safeSlug ? `${safeSlug}.md` : `${safeTitle}.md`;
  await fs.writeFile(path.join(dataDir, filename), fileContent);
  return new Response(
    JSON.stringify({ success: true, slug: filename.replace('.md', '') }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/recipes.ts
git commit -m "fix: recipes.ts GET — recursive walk matches index.astro + supports ?slug= param"
```

---

### Task C2: Layout.astro — add Footer and nav links

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: Add Footer import to the frontmatter**

In the `---` block at the top, add:

```astro
import Footer from '../components/Footer.astro';
```

- [ ] **Step 2: Add About and Suggest nav links to the header**

In the `<nav class="site-nav">` block, add two new links after `<a href="/" class="nav-link">Recipes</a>` and before the CTA:

```html
<a href="/#about" class="nav-link">About</a>
<a href="/#contact" class="nav-link">Suggest</a>
```

- [ ] **Step 3: Add `<Footer />` before `</body>`**

After `<slot />` and before `</body>`, insert:

```astro
    <Footer />
```

The final `<body>` should look like:

```html
<body>
  <header class="site-header">
    ...
  </header>
  <slot />
  <Footer />
</body>
```

- [ ] **Step 4: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat: Layout.astro — add Footer component + About/Suggest nav links"
```

---

## Wave D — Modify Pages (Parallel)

Both tasks touch different files. They depend on Wave A (components exist) and Wave B (CSS classes exist).

### Task D1: index.astro — hero search, filter bar, card thumbnails, sections

**Files:**
- Modify: `src/pages/index.astro`

This is the largest single change. Make all 6 modifications described below, then commit once.

- [ ] **Step 1: Add component imports to the frontmatter**

In the `---` block, add after the existing imports:

```astro
import AboutSection from '../components/AboutSection.astro';
import ContactSection from '../components/ContactSection.astro';
```

- [ ] **Step 2: Replace hero content to embed search + add CTA button**

Replace the entire `<div class="hero-banner__content">` block (currently contains title, subtitle) with:

```astro
<div class="hero-banner__content">
  <h1 class="hero-banner__title">Sven's Cookbook</h1>
  <p class="hero-banner__subtitle">A personal collection of recipes, crafted with care.</p>
  <div class="hero-search">
    <svg class="hero-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      type="text"
      id="search-bar"
      class="hero-search__input"
      placeholder="Search recipes or ingredients..."
      aria-label="Search recipes"
    />
  </div>
  <a href="#recipe-list" class="hero-banner__cta">
    Browse Recipes
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </a>
</div>
```

- [ ] **Step 3: Remove the old standalone search container inside `<main>`**

Delete these lines from inside `<main>`:

```astro
<!-- Search -->
<div class="search-container">
  <input
    type="text"
    id="search-bar"
    class="search-input"
    placeholder="Search recipes or ingredients..."
    aria-label="Search recipes"
  />
</div>
```

- [ ] **Step 4: Add filters bar inside `<main>` before `<div id="recipe-list">`**

```astro
<!-- Filters Bar -->
<div class="filters-bar" id="filters-bar">
  <select class="filter-select" id="category-filter" aria-label="Filter by category">
    <option value="ALL">All Categories</option>
    {sortedCategories.map((cat) => (
      <option value={cat}>{cat}</option>
    ))}
  </select>
  <button class="filter-clear" id="filter-clear" type="button">Clear filters</button>
</div>
```

- [ ] **Step 5: Replace the recipe card template to add thumbnail + download button**

Replace the `<a class="recipe-card" ...>` block inside the grid map with:

```astro
<a
  href={`/recipes/${recipe.slug}`}
  class="recipe-card"
  data-title={recipe.title.toLowerCase()}
  data-desc={(recipe.description || '').toLowerCase()}
  data-category={category}
>
  <img
    src={`/images/${recipe.slug}.jpg`}
    alt={recipe.title}
    class="recipe-card__thumb"
    loading="lazy"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
  />
  <div class="recipe-card__thumb-placeholder" style="display:none;" aria-hidden="true">🍽</div>
  <span class="recipe-card__badge">{category}</span>
  <div class="recipe-card__body">
    <h3>{recipe.title}</h3>
    <p class="desc">{recipe.description}</p>
    <div class="recipe-meta-inline">
      {recipe.prepTime && recipe.prepTime !== 'N/A' && (
        <span>⏱ {recipe.prepTime}</span>
      )}
      {recipe.cookTime && recipe.cookTime !== 'N/A' && (
        <span>🍳 {recipe.cookTime}</span>
      )}
      {recipe.yieldVal && recipe.yieldVal !== 'N/A' && (
        <span>🍽 {recipe.yieldVal}</span>
      )}
    </div>
    <a
      href={`/api/download?slug=${recipe.slug}`}
      class="recipe-card__download"
      download
      onclick="event.stopPropagation();"
      title={`Download ${recipe.title} as markdown`}
      aria-label={`Download ${recipe.title}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download
    </a>
  </div>
</a>
```

- [ ] **Step 6: Add AboutSection and ContactSection below `#no-results`, before `</main>`**

```astro
    <AboutSection />
    <ContactSection />
```

- [ ] **Step 7: Replace the `<script>` block with the updated filter script**

Replace the entire `<script>` block with:

```typescript
<script>
  const searchBar = document.getElementById('search-bar') as HTMLInputElement;
  const categoryFilter = document.getElementById('category-filter') as HTMLSelectElement;
  const filterClear = document.getElementById('filter-clear') as HTMLButtonElement;
  const categorySections = document.querySelectorAll('.category-section');
  const noResults = document.getElementById('no-results') as HTMLDivElement;

  function applyFilters() {
    const query = searchBar ? searchBar.value.toLowerCase().trim() : '';
    const selectedCat = categoryFilter ? categoryFilter.value : 'ALL';
    let totalVisible = 0;

    categorySections.forEach((section) => {
      const sectionCat = section.getAttribute('data-category') || '';
      const catMatch = selectedCat === 'ALL' || sectionCat === selectedCat;
      if (!catMatch) {
        (section as HTMLElement).style.display = 'none';
        return;
      }
      const cards = section.querySelectorAll('.recipe-card');
      let visible = 0;
      cards.forEach((card) => {
        const title = card.getAttribute('data-title') || '';
        const desc = card.getAttribute('data-desc') || '';
        const match = !query || title.includes(query) || desc.includes(query);
        (card as HTMLElement).style.display = match ? 'flex' : 'none';
        if (match) visible++;
      });
      (section as HTMLElement).style.display = visible === 0 ? 'none' : 'block';
      totalVisible += visible;
    });

    if (noResults) noResults.style.display = totalVisible === 0 ? 'block' : 'none';
  }

  if (searchBar) searchBar.addEventListener('input', applyFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
  if (filterClear) {
    filterClear.addEventListener('click', () => {
      if (searchBar) searchBar.value = '';
      if (categoryFilter) categoryFilter.value = 'ALL';
      applyFilters();
    });
  }
</script>
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: index.astro — hero search + CTA, category filter, card thumbnails + download, About + Contact sections"
```

---

### Task D2: [slug].astro — prev/next cooking step navigation

**Files:**
- Modify: `src/pages/recipes/[...slug].astro`

- [ ] **Step 1: Add the step-nav HTML after the cooking-progress div**

After the closing `</div>` of `<div class="cooking-progress" id="cooking-progress">` (the block containing `#progress-fill` and `#progress-label`), insert:

```html
<!-- Step navigation — CSS shows/hides based on .cooking-mode-active on body -->
<div class="step-nav" id="step-nav">
  <button class="step-nav__btn" id="step-prev" type="button" disabled>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Prev
  </button>
  <span class="step-nav__indicator" id="step-indicator">Step 1</span>
  <button class="step-nav__btn" id="step-next" type="button">
    Next
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>
</div>
```

- [ ] **Step 2: Add prev/next wiring to the client `<script>`**

Inside the `document.addEventListener('DOMContentLoaded', ...)` callback, after the existing `toggleBtn` event listener, add:

```javascript
      // === PREV / NEXT STEP NAVIGATION ===
      const prevBtn = document.getElementById('step-prev') as HTMLButtonElement;
      const nextBtn = document.getElementById('step-next') as HTMLButtonElement;
      const stepIndicator = document.getElementById('step-indicator');
      let currentStepIndex = 0;

      function syncNavButtons() {
        if (prevBtn) prevBtn.disabled = currentStepIndex === 0;
        if (nextBtn) nextBtn.disabled = currentStepIndex >= allSteps.length - 1;
        if (stepIndicator) stepIndicator.textContent = `Step ${currentStepIndex + 1} of ${allSteps.length}`;
      }

      function goToStep(index: number) {
        if (index < 0 || index >= allSteps.length) return;
        currentStepIndex = index;
        allSteps.forEach((s, i) => {
          s.classList.remove('active', 'completed');
          if (i < index) s.classList.add('completed');
        });
        allSteps[currentStepIndex].classList.add('active');
        allSteps[currentStepIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        updateProgress();
        syncNavButtons();
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (document.body.classList.contains('cooking-mode-active')) goToStep(currentStepIndex - 1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (document.body.classList.contains('cooking-mode-active')) goToStep(currentStepIndex + 1);
        });
      }

      // Reset step index when cooking mode is toggled off
      const origToggleHandler = toggleBtn?.onclick;
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          currentStepIndex = 0;
          syncNavButtons();
        }, true); // capture phase — runs before existing listener
      }
```

- [ ] **Step 3: Commit**

```bash
git add "src/pages/recipes/[...slug].astro"
git commit -m "feat: cooking mode prev/next step navigation in [slug].astro"
```

---

## Final: Tests → Build → Docker → Push

### Task Final-1: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected output (all should pass):
```
✓ src/utils/recipeParser.test.js (6)
✓ src/utils/filterRecipes.test.ts (7)
✓ src/utils/slugUtils.test.ts (6)
✓ src/components/ContactForm.test.jsx (4)
Test Files  4 passed (4)
Tests       23 passed (23)
```

If any test fails: fix the failing test's implementation (do NOT modify the test), then re-run.

---

### Task Final-2: Astro type check + production build

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: `astro check` passes with zero errors, `astro build` succeeds with output like `✓ Completed in Xs`.

If TypeScript errors appear: fix them in the relevant source file.

---

### Task Final-3: Docker build and smoke test

- [ ] **Step 1: Build and start the container**

```bash
docker compose build
docker compose up -d
```

Expected: `Container svens-cookbook-app  Started`

- [ ] **Step 2: Smoke test homepage**

```bash
curl -s http://localhost:4321/ | grep -o "Sven's Cookbook"
```

Expected output: `Sven's Cookbook`

- [ ] **Step 3: Smoke test hero banner image**

```bash
curl -I http://localhost:4321/images/hero-banner.jpg
```

Expected: `HTTP/1.1 200 OK` — confirms hero image is baked into Docker image.

- [ ] **Step 4: Smoke test download endpoint**

```bash
curl -sI "http://localhost:4321/api/download?slug=shahi-kaju-paneer-gravy"
```

Expected response headers to include:
```
content-disposition: attachment; filename="shahi-kaju-paneer-gravy.md"
content-type: text/markdown; charset=utf-8
```

- [ ] **Step 5: Smoke test legal page**

```bash
curl -s http://localhost:4321/legal | grep -o "Legal"
```

Expected: `Legal`

- [ ] **Step 6: Smoke test 404 page**

```bash
curl -s http://localhost:4321/does-not-exist | grep -o "Recipe Not Found"
```

Expected: `Recipe Not Found`

- [ ] **Step 7: Stop container**

```bash
docker compose down
```

---

### Task Final-4: Commit all remaining changes and push

- [ ] **Step 1: Stage all new and modified files**

```bash
git add \
  src/components/Footer.astro \
  src/components/AboutSection.astro \
  src/components/ContactSection.astro \
  src/components/ContactForm.jsx \
  src/components/ContactForm.test.jsx \
  src/pages/404.astro \
  src/pages/legal.astro \
  src/pages/api/download.ts \
  src/pages/api/suggest.ts \
  src/utils/filterRecipes.ts \
  src/utils/filterRecipes.test.ts \
  src/utils/slugUtils.ts \
  src/utils/slugUtils.test.ts \
  src/utils/recipeParser.test.js \
  src/styles/global.css \
  src/layouts/Layout.astro \
  src/pages/index.astro \
  "src/pages/recipes/[...slug].astro" \
  src/pages/api/recipes.ts \
  docs/superpowers/plans/2026-06-02-bcms-parity.md
```

- [ ] **Step 2: Verify nothing unexpected is staged**

```bash
git status
```

Review the staged list. Do not include `.env`, secrets, or large binaries beyond hero-banner.jpg.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: BCMS reference parity — footer, about, contact, download API, category filter, step-nav, hero search, card thumbnails, 404, legal; full TDD (23 tests)"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: `Branch 'main' set up to track remote branch 'main' from 'origin'.` or `main -> main`.

---

## Verification Checklist

Before marking this plan complete:

- [ ] `npx vitest run` — 23 tests pass across 4 files
- [ ] `npm run build` — zero TypeScript errors
- [ ] Homepage: hero image + embedded search bar + "Browse Recipes" CTA button visible
- [ ] Category dropdown filters grid; "Clear filters" resets both search and category
- [ ] Recipe cards: image thumbnail (or 🍽 placeholder) + Download button on each card
- [ ] Download button: clicking downloads a `.md` file, doesn't navigate away from card
- [ ] Recipe detail cooking mode: clicking "Start Cooking" reveals prev/next nav bar
- [ ] Prev/Next buttons advance through steps; Prev disabled on step 1, Next disabled on last step
- [ ] Progress bar updates correctly when using Prev (marks steps uncompleted)
- [ ] Footer renders on ALL pages (home, recipe detail, editor, legal)
- [ ] Footer legal link navigates to `/legal`
- [ ] `/legal` renders "Legal" heading and privacy text
- [ ] Visiting a non-existent URL (e.g. `/this-does-not-exist`) renders "Recipe Not Found" (not a blank page)
- [ ] `/#about` anchor: About section visible with 3 stat items
- [ ] `/#contact` form: fill name + email + suggestion → submit → "Thanks! Suggestion received." appears
- [ ] `data/suggestions.log` created with the submission entry
- [ ] Docker: `docker compose up` starts cleanly on port 4321
- [ ] Hero image visible in the Docker container (not a broken image)
- [ ] `git push origin main` succeeds
