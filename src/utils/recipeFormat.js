import matter from 'gray-matter';

export function serializeRecipe(recipe = {}) {
  const {
    title = '', category = '', description = '',
    prepTime = '', cookTime = '', yieldVal = '',
    imageUrl = '', miseEnPlace = [],
    ingredients = [], steps = [],
  } = recipe;

  let body = String(description || '').trim();

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    body += '\n\n## Ingredients\n\n';
    for (const ing of ingredients) {
      const item = String(typeof ing === 'string' ? ing : (ing.item || '')).trim();
      const proportion = String(typeof ing === 'string' ? '' : (ing.proportion || '')).trim();
      if (!item && !proportion) continue;
      body += proportion ? `- **${proportion}** ${item}\n` : `- ${item}\n`;
    }
  }

  if (Array.isArray(steps) && steps.length > 0) {
    body += '\n\n## Instructions\n\n';
    steps.forEach((step, i) => {
      const s = String(typeof step === 'string' ? step : String(step)).trim();
      body += `${i + 1}. ${s}\n`;
    });
  }

  const data = { title, category };
  if (prepTime) data.prepTime = prepTime;
  if (cookTime) data.cookTime = cookTime;
  if (yieldVal) data.yieldVal = yieldVal;
  if (imageUrl) data.imageUrl = imageUrl;
  if (Array.isArray(miseEnPlace) && miseEnPlace.length > 0) data.miseEnPlace = miseEnPlace;

  return matter.stringify(body ? `${body.trim()}\n` : '', data);
}
