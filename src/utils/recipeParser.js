/**
 * Parses raw recipe markdown files to extract structured metadata.
 * Handles both the modern frontmatter-less bold metadata format and Jeff's classic ## info list format.
 * 
 * @param {string} filePath - Path of the markdown file
 * @param {string} rawContent - Raw text content of the markdown file
 * @returns {object} Structured recipe metadata
 */
export function parseRecipe(filePath, rawContent) {
  // Normalize slashes for cross-platform reliability (Windows uses \ in filesystem, Vite uses /)
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Extract relative path after /Recipes/
  const recipesIndex = normalizedPath.lastIndexOf('/Recipes/');
  let relativePath = '';
  if (recipesIndex !== -1) {
    relativePath = normalizedPath.substring(recipesIndex + '/Recipes/'.length);
  } else {
    relativePath = normalizedPath.split('/').pop() || '';
  }
  
  // Split relative path to identify parent directory (Category) and filename (Slug)
  const parts = relativePath.split('/');
  let category = 'General';
  let slug = relativePath.replace(/\.md$/, '').toLowerCase();
  
  if (parts.length > 1) {
    // If inside a folder, that folder name is our category (e.g. "Sandwiches", "Mains")
    category = parts[0];
  }
  
  // Extract title (the first top-level header "# Title")
  const titleMatch = rawContent.match(/^#\s+(.+)$/m);
  let title = titleMatch ? titleMatch[1].trim() : '';
  if (!title) {
    // Fallback: derive title from filename
    const fileName = parts[parts.length - 1].replace(/\.md$/, '');
    title = fileName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  // Initialize metadata values
  let prepTime = '';
  let cookTime = '';
  let yieldVal = '';
  
  // 1. Look for bold inline markers (e.g. **Prep time:** 10 Minutes)
  const prepMatch = rawContent.match(/\*\*Prep\s+[Tt]ime:\*\*\s*(.+)$/m);
  const cookMatch = rawContent.match(/\*\*Cook\s+[Tt]ime:\*\*\s*(.+)$/m);
  const yieldMatch = rawContent.match(/\*\*Yield:\*\*\s*(.+)$/m);
  
  if (prepMatch) prepTime = prepMatch[1].replace(/<br\s*\/?>/gi, '').trim();
  if (cookMatch) cookTime = cookMatch[1].replace(/<br\s*\/?>/gi, '').trim();
  if (yieldMatch) yieldVal = yieldMatch[1].replace(/<br\s*\/?>/gi, '').trim();
  
  // 2. Fallback to parsing Jeff's ## info block (e.g., list items containing minutes/servings)
  if (!prepTime || !yieldVal) {
    const infoSectionMatch = rawContent.match(/##\s+info\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (infoSectionMatch) {
      const infoText = infoSectionMatch[1];
      const infoLines = infoText
        .split('\n')
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
  
  // 3. Extract description (first non-empty paragraph after title, skipping metadata lines and HRs)
  const lines = rawContent.split('\n');
  let description = '';
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
  
  if (!description) {
    description = `A delicious recipe for ${title}.`;
  }
  
  return {
    title,
    category,
    slug,
    prepTime: prepTime || 'N/A',
    cookTime: cookTime || 'N/A',
    yieldVal: yieldVal || 'N/A',
    description
  };
}
