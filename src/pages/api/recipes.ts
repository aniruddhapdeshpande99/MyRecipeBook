// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';
import { sanitiseSlug } from '../../utils/slugUtils';
import { extractRecipe, serializeRecipe } from '../../utils/recipeFormat';

export async function GET({ request }: { request: Request }) {
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (slug) {
    const safeSlug = sanitiseSlug(slug);
    if (!safeSlug) {
      return new Response(JSON.stringify({ error: 'Invalid slug' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    let filePath = path.join(dataDir, safeSlug, `${safeSlug}.md`);
    try {
      await fs.access(filePath);
    } catch {
      filePath = path.join(dataDir, `${safeSlug}.md`);
    }

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const r = extractRecipe(raw);

      let imageUrl = r.imageUrl || '';
      if (!imageUrl) {
        try {
          await fs.access(path.join(dataDir, safeSlug, 'hero.jpg'));
          imageUrl = `/images/${safeSlug}/hero.jpg`;
        } catch { /* no hero image */ }
      }

      return new Response(
        JSON.stringify({ ...r, category: r.category || 'General', slug: safeSlug, imageUrl }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
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
    const r = extractRecipe(raw);
    return { slug: path.basename(fp, '.md'), ...r, category: r.category || 'General' };
  }));

  return new Response(JSON.stringify(recipes), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: { request: Request }) {
  const data = await request.json();
  const { slug, title, category, ingredients, steps, description, imageUrl, miseEnPlace, prepTime, cookTime, yieldVal } = data;
  const safeSlug = slug ? sanitiseSlug(slug) : '';
  const safeTitle = title
    ? title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : 'untitled';
  
  const recipeSlug = safeSlug || safeTitle;
  let finalImageUrl = imageUrl;
  
  const recipeDir = path.join(process.cwd(), 'data', 'recipes', recipeSlug);

  if (imageUrl && imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      const extension = mimeType.split('/')[1] || 'jpg';
      const imageFilename = `hero.${extension}`;
      const imagePathOnDisk = path.join(recipeDir, imageFilename);

      await fs.mkdir(recipeDir, { recursive: true });
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(imagePathOnDisk, buffer);
      
      finalImageUrl = `/images/${recipeSlug}/${imageFilename}`;
    }
  }

  // Process miseEnPlace images
  const finalMiseEnPlace = [];
  if (Array.isArray(miseEnPlace)) {
    const miseDir = path.join(recipeDir, 'miseenplace');
    if (miseEnPlace.some(img => img && img.startsWith('data:image/'))) {
      await fs.mkdir(miseDir, { recursive: true });
    }
    
    for (let i = 0; i < miseEnPlace.length; i++) {
      const img = miseEnPlace[i];
      if (img && img.startsWith('data:image/')) {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const extension = mimeType.split('/')[1] || 'jpg';
          const filename = `mise-${Date.now()}-${i}.${extension}`;
          const imagePathOnDisk = path.join(miseDir, filename);
          
          const buffer = Buffer.from(match[2], 'base64');
          await fs.writeFile(imagePathOnDisk, buffer);
          
          finalMiseEnPlace.push(`/images/${recipeSlug}/miseenplace/${filename}`);
        }
      } else if (img) {
        // It's already a URL
        finalMiseEnPlace.push(img);
      }
    }
  }

  const mdFilename = `${recipeSlug}.md`;
  const mdPath = path.join(process.cwd(), 'data', 'recipes', mdFilename);

  let existingNotes = '';
  try {
    existingNotes = extractRecipe(await fs.readFile(mdPath, 'utf-8')).notes || '';
  } catch {
    // new recipe — no existing notes
  }

  const fileContent = serializeRecipe({
    title, category, description,
    prepTime, cookTime, yieldVal,
    imageUrl: finalImageUrl, miseEnPlace: finalMiseEnPlace,
    ingredients, steps, notes: existingNotes,
  });

  await fs.mkdir(path.join(process.cwd(), 'data', 'recipes'), { recursive: true });
  await fs.writeFile(mdPath, fileContent);

  return new Response(
    JSON.stringify({ success: true, slug: recipeSlug }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
