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
