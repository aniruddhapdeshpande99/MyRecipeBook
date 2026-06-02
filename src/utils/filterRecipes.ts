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
