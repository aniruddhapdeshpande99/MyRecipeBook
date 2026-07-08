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
