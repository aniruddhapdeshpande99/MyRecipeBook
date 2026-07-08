# Fix ContactForm Vitest Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the 4 `ContactForm.test.jsx` tests pass in the Docker dev container by mounting the Vitest config into it.

**Architecture:** The `dev` service in `docker-compose.yml` bind-mounts only `src`, `public`, `data`, and `astro.config.mjs`. `vitest.config.ts` (which sets `environment: 'jsdom'`, `setupFiles`, `globals: true`) and `vitest.setup.ts` are not present in the container, so Vitest falls back to defaults (node env, no jsdom, no auto-cleanup) → `ReferenceError: document is not defined`, and without setup/globals the React Testing Library auto-cleanup never registers. Mounting both files fixes it — verified: with them mounted, all 4 tests pass.

**Tech Stack:** Docker Compose, Vitest 2.1.8, jsdom, @testing-library/react.

## Global Constraints

- Root cause is the container missing the Vitest config — do NOT "fix" it by weakening the tests, changing the test environment in code, or deleting assertions.
- Do not modify `ContactForm.test.jsx`, `vitest.config.ts`, or `vitest.setup.ts` — the fix is purely the compose mount.
- Canonical test command stays `docker compose run --rm dev npm run test:run`.
- Commits: NO Claude authorship / NO `Co-Authored-By` trailer.
- Branch: `fix/recipe-canonical-format`.

---

## Task 1: Mount vitest config + setup into the dev container

**Files:**
- Modify: `docker-compose.yml` (the `dev` service `volumes:` list)

**Interfaces:** none (infra change).

- [ ] **Step 1: Establish the failing test (red)**

Run: `docker compose run --rm dev npx vitest run src/components/ContactForm.test.jsx`
Expected: FAIL — `Test Files 1 failed`, 4 tests failing with `ReferenceError: document is not defined`. This is the red state the fix must turn green.

- [ ] **Step 2: Add the two bind mounts to the dev service**

In `docker-compose.yml`, under the `dev:` service `volumes:` list, alongside the existing `- ./astro.config.mjs:/app/astro.config.mjs` line, add:

```yaml
      - ./vitest.config.ts:/app/vitest.config.ts
      - ./vitest.setup.ts:/app/vitest.setup.ts
```

(Place them immediately after the `- ./astro.config.mjs:/app/astro.config.mjs` line, keeping the same indentation as the other volume entries. Do not touch the `dev_node_modules` named-volume line or any other service.)

- [ ] **Step 3: Verify the ContactForm tests pass (green)**

Run: `docker compose run --rm dev npx vitest run src/components/ContactForm.test.jsx`
Expected: PASS — `Test Files 1 passed`, `Tests 4 passed`.

- [ ] **Step 4: Verify the full suite is now fully green**

Run: `docker compose run --rm dev npm run test:run`
Expected: PASS — all test files pass (recipeFormat, recipeParser, filterRecipes, slugUtils, ContactForm), 0 failed.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: mount vitest config into dev container so jsdom tests run"
```

---

## Self-Review

- **Coverage:** the single infra gap (missing config in container) is addressed by the mount; no other file needs changing (verified: mounting alone makes all 4 tests pass, including the cleanup-dependent "multiple elements" case, because `globals: true` + setup restore Testing Library auto-cleanup).
- **Placeholders:** none — exact YAML lines and commands with expected output given.
- **No test weakening:** the plan changes only `docker-compose.yml`.
