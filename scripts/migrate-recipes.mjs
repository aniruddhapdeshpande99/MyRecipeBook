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
