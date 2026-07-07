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
    ingredients: r.ingredients,
    steps: r.steps,
    notes: r.notes,
    content: r.content,
  };
}
