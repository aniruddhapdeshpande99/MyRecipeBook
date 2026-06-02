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
