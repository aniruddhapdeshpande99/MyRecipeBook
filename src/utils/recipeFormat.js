import matter from 'gray-matter';

export function recipeBodyMarkdown(recipe = {}) {
  const { description = '', ingredients = [], steps = [], notes = '' } = recipe;
  let body = String(description || '').trim();

  const ings = normalizeIngredients(ingredients);
  if (ings.length > 0) {
    body += '\n\n## Ingredients\n\n';
    for (const ing of ings) {
      body += ing.proportion ? `- **${ing.proportion}** ${ing.item}\n` : `- ${ing.item}\n`;
    }
  }

  const sts = normalizeSteps(steps);
  if (sts.length > 0) {
    body += '\n\n## Instructions\n\n';
    sts.forEach((s, i) => { body += `${i + 1}. ${s}\n`; });
  }

  const n = String(notes || '').trim();
  if (n) body += `\n\n${n}`;

  return body.trim();
}

export function serializeRecipe(recipe = {}) {
  const {
    title = '', category = '',
    prepTime = '', cookTime = '', yieldVal = '',
    imageUrl = '', miseEnPlace = [],
  } = recipe;

  const body = recipeBodyMarkdown(recipe);

  const data = { title, category };
  if (prepTime) data.prepTime = prepTime;
  if (cookTime) data.cookTime = cookTime;
  if (yieldVal) data.yieldVal = yieldVal;
  if (imageUrl) data.imageUrl = imageUrl;
  if (Array.isArray(miseEnPlace) && miseEnPlace.length > 0) data.miseEnPlace = miseEnPlace;

  return matter.stringify(body ? `${body}\n` : '', data);
}

export function extractRecipe(rawContent = '') {
  const parsed = matter(rawContent || '');
  const data = parsed.data || {};
  const content = parsed.content || '';

  let ingredients = normalizeIngredients(data.ingredients);
  let steps = normalizeSteps(data.steps);
  if (ingredients.length === 0 || steps.length === 0) {
    const fromBody = parseBodySections(content);
    if (ingredients.length === 0) ingredients = fromBody.ingredients;
    if (steps.length === 0) steps = fromBody.steps;
  }

  const title = data.title || deriveTitleFromBody(content) || '';
  const description = data.description
    ? String(data.description)
    : extractDescription(content, title);

  // Metadata: frontmatter wins; fall back to inline **Prep time:** markers in
  // the body (legacy recipes). Preserves recipeParser's existing behavior.
  let prepTime = data.prepTime || '';
  let cookTime = data.cookTime || '';
  let yieldVal = data.yieldVal || '';
  if (!prepTime || !cookTime || !yieldVal) {
    const prepMatch = content.match(/\*\*Prep\s+[Tt]ime:\*\*\s*(.+)$/m);
    const cookMatch = content.match(/\*\*Cook\s+[Tt]ime:\*\*\s*(.+)$/m);
    const yieldMatch = content.match(/\*\*Yield:\*\*\s*(.+)$/m);
    if (!prepTime && prepMatch) prepTime = prepMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    if (!cookTime && cookMatch) cookTime = cookMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    if (!yieldVal && yieldMatch) yieldVal = yieldMatch[1].replace(/<br\s*\/?>/gi, '').trim();
  }

  // Legacy "## info" bullet block: first time-like bullet → prep, next → cook,
  // servings/yield/makes bullet → yield. (Restores old recipeParser behavior.)
  if (!prepTime || !yieldVal) {
    const infoMatch = content.match(/##\s+info\s*:?\s*\r?\n([\s\S]*?)(?=\n##|$)/i);
    if (infoMatch) {
      const infoLines = infoMatch[1].split(/\r?\n/).map(l => l.trim())
        .filter(l => l.startsWith('*') || l.startsWith('-'));
      for (const l of infoLines) {
        const text = l.replace(/^[\*\-\s]+/, '').trim();
        if (/time|minute|hour/i.test(text)) {
          if (!prepTime) prepTime = text;
          else if (!cookTime) cookTime = text;
        } else if (/\b(serves?|servings?|yields?|makes)\b/i.test(text)) {
          if (!yieldVal) yieldVal = text;
        }
      }
    }
  }

  return {
    title,
    category: data.category || '',
    description,
    prepTime,
    cookTime,
    yieldVal,
    imageUrl: data.imageUrl || '',
    miseEnPlace: Array.isArray(data.miseEnPlace) ? data.miseEnPlace : [],
    ingredients,
    steps,
    notes: extractNotes(content),
  };
}

function normalizeIngredients(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(ing => typeof ing === 'string'
      ? { item: ing.trim(), proportion: '' }
      : { item: String(ing.item || '').trim(), proportion: String(ing.proportion || '').trim() })
    .filter(i => i.item || i.proportion);
}

function normalizeSteps(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => String(typeof s === 'string' ? s : String(s)).trim()).filter(Boolean);
}

function deriveTitleFromBody(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[\s:#]+$/, '').trim() : '';
}

function classifyHeading(line) {
  const m = String(line).trim().match(/^(#{1,2})\s+(.+)$/);
  if (!m) return null;
  // Strip trailing whitespace, colons, and closed-ATX hashes (e.g. "## Notes ##").
  const text = m[2].replace(/[\s:#]+$/, '').trim().toLowerCase();
  if (/^ingredients?$/.test(text)) return 'ingredients';
  if (/^(instructions?|steps?|methods?|directions?)$/.test(text)) return 'steps';
  if (/^info$/.test(text)) return 'meta';
  if (/^(notes?|tips?|origins?)$/.test(text) || /^based on\b/.test(text)) return 'notes';
  return m[1] === '##' ? 'notes' : 'title';
}

function parseBodySections(content) {
  const ingredients = [];
  const steps = [];
  let section = null;
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    const kind = classifyHeading(t);
    if (kind) { section = (kind === 'ingredients' || kind === 'steps') ? kind : null; continue; }
    if (section === 'ingredients' && (t.startsWith('- ') || t.startsWith('* '))) {
      const itemStr = t.replace(/^[-*]\s*/, '').trim();
      const m = itemStr.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (m) ingredients.push({ proportion: m[1].trim(), item: m[2].trim() });
      else ingredients.push({ item: itemStr, proportion: '' });
    } else if (section === 'steps' && /^\d+\.\s+/.test(t)) {
      steps.push(t.replace(/^\d+\.\s*/, '').trim());
    } else if (section === 'steps' && (t.startsWith('- ') || t.startsWith('* '))) {
      steps.push(t.replace(/^[-*]\s*/, '').trim());
    }
  }
  return { ingredients, steps };
}

function extractNotes(content) {
  const out = [];
  let capturing = false;
  for (const raw of content.split(/\r?\n/)) {
    const kind = classifyHeading(raw);
    if (kind) {
      capturing = kind === 'notes';
      if (capturing) out.push(raw);
      continue;
    }
    if (capturing) out.push(raw);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractDescription(content, title) {
  const collected = [];
  for (const raw of content.split(/\r?\n/)) {
    const kind = classifyHeading(raw);
    if (kind === 'ingredients' || kind === 'steps' || kind === 'notes' || kind === 'meta') break;
    if (kind === 'title') continue;
    const line = raw.trim();
    if (line.startsWith('**Prep') || line.startsWith('**Cook') || line.startsWith('**Yield')) continue;
    if (line.startsWith('---')) continue;
    collected.push(raw);
  }
  const desc = collected.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return desc || `A delicious recipe for ${title || 'this dish'}.`;
}
