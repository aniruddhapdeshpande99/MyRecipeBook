import { describe, it, expect } from 'vitest';
import { parseRecipe } from './recipeParser';

describe('recipeParser', () => {
  it('parses legacy markdown files correctly', () => {
    const rawContent = `
# Classic Aloo Matar

**Prep time:** 15 mins
**Cook time:** 30 mins
**Yield:** 4 servings

A wonderful potato and pea curry.
    `;
    const result = parseRecipe('data/recipes/Mains/aloo-matar.md', rawContent);
    expect(result.title).toBe('Classic Aloo Matar');
    expect(result.prepTime).toBe('15 mins');
    expect(result.cookTime).toBe('30 mins');
    expect(result.yieldVal).toBe('4 servings');
    expect(result.description).toBe('A wonderful potato and pea curry.');
    expect(result.category).toBe('Mains');
    // We expect the slug to just be the basename for dynamic loading
    expect(result.slug).toBe('aloo-matar');
  });

  it('parses modern gray-matter YAML frontmatter correctly', () => {
    const rawContent = `---
title: "Shahi Kaju Paneer Gravy"
description: "A rich and creamy cashew paneer dish."
category: "Mains"
prepTime: "20 min"
cookTime: "40 min"
yieldVal: "6 servings"
---
# Ingredients
- Cashews
    `;
    const result = parseRecipe('data/recipes/shahi-kaju.md', rawContent);
    expect(result.title).toBe('Shahi Kaju Paneer Gravy');
    expect(result.description).toBe('A rich and creamy cashew paneer dish.');
    expect(result.category).toBe('Mains');
    expect(result.prepTime).toBe('20 min');
    expect(result.cookTime).toBe('40 min');
    expect(result.yieldVal).toBe('6 servings');
  });

  it('handles carriage returns safely', () => {
    const rawContent = "# Title\r\n\r\n**Prep time:** 10 mins\r\n\r\nA description.\r\n";
    const result = parseRecipe('data/recipes/test.md', rawContent);
    expect(result.prepTime).toBe('10 mins');
    expect(result.description).toBe('A description.');
  });
  
  it('extracts categories correctly regardless of path case or structure', () => {
     const result1 = parseRecipe('/data/recipes/Desserts/cake.md', '# Cake');
     const result2 = parseRecipe('/Recipes/Desserts/cake.md', '# Cake');
     const result3 = parseRecipe('C:\\Users\\Bob\\data\\recipes\\Desserts\\cake.md', '# Cake');
     
     expect(result1.category).toBe('Desserts');
     expect(result2.category).toBe('Desserts');
     expect(result3.category).toBe('Desserts');
  });
});
