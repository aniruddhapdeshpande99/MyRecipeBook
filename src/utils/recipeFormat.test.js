import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import { serializeRecipe, extractRecipe, recipeBodyMarkdown } from './recipeFormat';

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

describe('extractRecipe', () => {
  it('reads frontmatter-array recipes (no body sections)', () => {
    const raw = `---
title: Bagel
category: Fusion
ingredients:
  - item: Mushroom
    proportion: 200g
steps:
  - Toast bagel.
---
`;
    const r = extractRecipe(raw);
    expect(r.title).toBe('Bagel');
    expect(r.category).toBe('Fusion');
    expect(r.ingredients).toEqual([{ item: 'Mushroom', proportion: '200g' }]);
    expect(r.steps).toEqual(['Toast bagel.']);
  });

  it('reads ##-heading body sections and a body description (no # heading)', () => {
    const raw = `---
title: Rajma
category: Punjabi
---
Best served with rice.

## Ingredients

- **2 large** Onion

## Instructions

1. Chop onions.
2. Cook.
`;
    const r = extractRecipe(raw);
    expect(r.description).toBe('Best served with rice.');   // Bug A: real description, not fallback
    expect(r.ingredients).toEqual([{ proportion: '2 large', item: 'Onion' }]);
    expect(r.steps).toEqual(['Chop onions.', 'Cook.']);
  });

  it('reads legacy single-#-heading body sections (shahi-kaju shape)', () => {
    const raw = `---
title: Shahi Kaju
description: Creamy cashew curry.
category: Mains
---
# Ingredients
- 250g Paneer

# Instructions
1. Soak cashews.
`;
    const r = extractRecipe(raw);
    expect(r.description).toBe('Creamy cashew curry.');       // from frontmatter
    expect(r.ingredients).toEqual([{ item: '250g Paneer', proportion: '' }]);
    expect(r.steps).toEqual(['Soak cashews.']);
  });

  it('deduplicates: a "both" file yields 2 steps, not 4', () => {
    const raw = `---
title: Dup
steps:
  - One.
  - Two.
---
## Instructions

1. One.
2. Two.
`;
    const r = extractRecipe(raw);
    expect(r.steps).toEqual(['One.', 'Two.']);   // frontmatter wins; body not double-counted
  });

  it('round-trips through serializeRecipe for a recipe with a description', () => {
    const original = {
      title: 'Rajma', category: 'Punjabi', description: 'Best with rice.',
      prepTime: '30 min', cookTime: '45 min', yieldVal: '4', imageUrl: '', miseEnPlace: [],
      ingredients: [{ item: 'Onion', proportion: '2 large' }],
      steps: ['Chop.', 'Cook.'],
    };
    const back = extractRecipe(serializeRecipe(original));
    expect(back.title).toBe('Rajma');
    expect(back.category).toBe('Punjabi');
    expect(back.description).toBe('Best with rice.');
    expect(back.prepTime).toBe('30 min');
    expect(back.ingredients).toEqual([{ proportion: '2 large', item: 'Onion' }]);
    expect(back.steps).toEqual(['Chop.', 'Cook.']);
  });
});
