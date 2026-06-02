import matter from 'gray-matter';

/**
 * Parses raw recipe markdown files to extract structured metadata.
 * Handles both the modern frontmatter format and classic formats.
 * 
 * @param {string} filePath - Path of the markdown file
 * @param {string} rawContent - Raw text content of the markdown file
 * @returns {object} Structured recipe metadata
 */
export function parseRecipe(filePath, rawContent) {
  // Normalize slashes for cross-platform reliability
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Extract relative path after /recipes/ or /Recipes/
  const recipesMatch = normalizedPath.match(/\/[Rr]ecipes\/(.+)$/);
  let relativePath = recipesMatch ? recipesMatch[1] : normalizedPath.split('/').pop() || '';
  
  // Split relative path to identify parent directory (Category) and filename (Slug)
  const parts = relativePath.split('/');
  let category = 'General';
  let slug = parts[parts.length - 1].replace(/\.md$/, '').toLowerCase();
  
  if (parts.length > 1) {
    // If inside a folder, that folder name is our category (e.g. "Sandwiches", "Mains")
    category = parts[0];
  }

  // Parse YAML frontmatter
  const parsed = matter(rawContent);
  const data = parsed.data || {};
  const content = parsed.content || rawContent;
  
  // 1. Extract title
  let title = data.title;
  if (!title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      // Fallback: derive title from filename
      title = slug
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }
  
  // 2. Extract metadata
  let prepTime = data.prepTime || '';
  let cookTime = data.cookTime || '';
  let yieldVal = data.yieldVal || '';
  
  // Fallback to bold inline markers
  if (!prepTime || !cookTime || !yieldVal) {
    const prepMatch = content.match(/\*\*Prep\s+[Tt]ime:\*\*\s*(.+)$/m);
    const cookMatch = content.match(/\*\*Cook\s+[Tt]ime:\*\*\s*(.+)$/m);
    const yieldMatch = content.match(/\*\*Yield:\*\*\s*(.+)$/m);
    
    if (!prepTime && prepMatch) prepTime = prepMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    if (!cookTime && cookMatch) cookTime = cookMatch[1].replace(/<br\s*\/?>/gi, '').trim();
    if (!yieldVal && yieldMatch) yieldVal = yieldMatch[1].replace(/<br\s*\/?>/gi, '').trim();
  }
  
  // Fallback to parsing Jeff's ## info block
  if (!prepTime || !yieldVal) {
    const infoSectionMatch = content.match(/##\s+info\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (infoSectionMatch) {
      const infoText = infoSectionMatch[1];
      const infoLines = infoText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.startsWith('*') || l.startsWith('-'));
      
      for (const line of infoLines) {
        const text = line.replace(/^[\*\-\s]+/, '').trim();
        if (/time|minutes|hours/i.test(text)) {
          if (!prepTime) {
            prepTime = text;
          } else if (!cookTime) {
            cookTime = text;
          }
        } else if (/servings|yield|makes/i.test(text)) {
          if (!yieldVal) {
            yieldVal = text;
          }
        }
      }
    }
  }
  
  // 3. Extract description
  let description = data.description || '';
  if (!description) {
    const lines = content.split(/\r?\n/);
    let foundTitle = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('# ')) {
        foundTitle = true;
        continue;
      }
      if (foundTitle && line !== '') {
        // Skip metadata, horizontal rules, lists, or headers
        if (
          line.startsWith('**Prep') || 
          line.startsWith('**Cook') || 
          line.startsWith('**Yield') || 
          line.startsWith('---') || 
          line.startsWith('##') || 
          line.startsWith('*') ||
          line.startsWith('-')
        ) {
          continue;
        }
        description = line;
        break;
      }
    }
    // Clean markdown bold/italics from the description
    description = description.replace(/\*\*|\*|_/g, '').trim();
  }
  
  if (!description) {
    description = `A delicious recipe for ${title}.`;
  }
  
  return {
    title,
    category: data.category || category,
    slug,
    prepTime: prepTime || 'N/A',
    cookTime: cookTime || 'N/A',
    yieldVal: yieldVal || 'N/A',
    imageUrl: data.imageUrl || '',
    description,
    content // Raw markdown body without frontmatter
  };
}
