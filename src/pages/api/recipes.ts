// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { sanitiseSlug } from '../../utils/slugUtils';
import { parseRecipe } from '../../utils/recipeParser';

export async function GET({ request }: { request: Request }) {
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (slug) {
    const safeSlug = sanitiseSlug(slug);
    if (!safeSlug) {
      return new Response(JSON.stringify({ error: 'Invalid slug' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const filePath = path.join(dataDir, `${safeSlug}.md`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(raw);
      const parsedRecipe = parseRecipe(filePath, raw);
      
      let ingredients = parsed.data.ingredients;
      let steps = parsed.data.steps;

      // Extract from markdown body if missing in frontmatter
      if (!ingredients || !steps || ingredients.length === 0 || steps.length === 0) {
        ingredients = [];
        steps = [];
        const lines = parsed.content.split(/\r?\n/);
        let inIngredients = false;
        let inSteps = false;

        for (const line of lines) {
          const t = line.trim();
          if (/^##\s+ingredient/i.test(t)) {
            inIngredients = true;
            inSteps = false;
            continue;
          }
          if (/^##\s+(instruction|step|method)/i.test(t)) {
            inSteps = true;
            inIngredients = false;
            continue;
          }
          if (/^##\s+/.test(t)) {
            inIngredients = false;
            inSteps = false;
            continue;
          }

          if (inIngredients && (t.startsWith('- ') || t.startsWith('* '))) {
            let itemStr = t.replace(/^[-*]\s*/, '').trim();
            const proportionMatch = itemStr.match(/^\*\*(.+?)\*\*\s*(.*)$/);
            if (proportionMatch) {
              ingredients.push({ proportion: proportionMatch[1].trim(), item: proportionMatch[2].trim() });
            } else {
              ingredients.push({ item: itemStr, proportion: '' });
            }
          }
          if (inSteps && /^\d+\.\s+/.test(t)) {
            steps.push(t.replace(/^\d+\.\s*/, '').trim());
          } else if (inSteps && (t.startsWith('- ') || t.startsWith('* '))) {
            steps.push(t.replace(/^[-*]\s*/, '').trim());
          }
        }
      }

      // Check for image existence if not in frontmatter
      let imageUrl = parsed.data.imageUrl || parsedRecipe.imageUrl || '';
      if (!imageUrl) {
        try {
          const publicImagePath = path.join(process.cwd(), 'public', 'images', `${safeSlug}.jpg`);
          await fs.access(publicImagePath);
          imageUrl = `/images/${safeSlug}.jpg`;
        } catch {
          // File doesn't exist
        }
      }

      return new Response(
        JSON.stringify({ 
          ...parsedRecipe,
          ...parsed.data, 
          slug: safeSlug, 
          ingredients,
          steps,
          imageUrl,
          content: parsed.content 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = await Promise.all(entries.map(async (e: any) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    }));
    return results.flat().filter((f: string) => f.endsWith('.md'));
  }

  const files = await walk(dataDir);
  const recipes = await Promise.all(files.map(async (fp) => {
    const raw = await fs.readFile(fp, 'utf-8');
    const parsed = matter(raw);
    return { slug: path.basename(fp, '.md'), ...parsed.data, content: parsed.content };
  }));

  return new Response(JSON.stringify(recipes), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: { request: Request }) {
  const data = await request.json();
  const { slug, title, category, ingredients, steps, description, imageUrl, prepTime, cookTime, yieldVal } = data;
  const safeSlug = slug ? sanitiseSlug(slug) : '';
  const safeTitle = title
    ? title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : 'untitled';
  
  const recipeSlug = safeSlug || safeTitle;
  let finalImageUrl = imageUrl;

  if (imageUrl && imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      const extension = mimeType === 'image/png' ? 'png' : 'jpg';
      const imageFilename = `${recipeSlug}.${extension}`;
      const imagePathOnDisk = path.join(process.cwd(), 'public', 'images', imageFilename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(imagePathOnDisk), { recursive: true });
      
      // Save decoded buffer
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(imagePathOnDisk, buffer);
      
      finalImageUrl = `/images/${imageFilename}`;
    }
  }

  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });
  const fileContent = matter.stringify(description || '', {
    title, category, prepTime, cookTime, yieldVal, imageUrl: finalImageUrl, ingredients, steps,
  });
  const filename = safeSlug ? `${safeSlug}.md` : `${safeTitle}.md`;
  await fs.writeFile(path.join(dataDir, filename), fileContent);
  return new Response(
    JSON.stringify({ success: true, slug: filename.replace('.md', '') }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
