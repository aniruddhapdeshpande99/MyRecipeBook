import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export async function GET({ request }: { request: Request }) {
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  if (slug) {
    const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(dataDir, `${safeSlug}.md`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(raw);
      return new Response(
        JSON.stringify({ slug: safeSlug, ...parsed.data, content: parsed.content }),
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
    const results = await Promise.all(entries.map(async (e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    }));
    return results.flat().filter((f) => f.endsWith('.md'));
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
  const { slug, title, category, ingredients, steps, description, prepTime, cookTime, yieldVal } = data;
  const safeSlug = slug ? slug.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  const safeTitle = title
    ? title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    : 'untitled';
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });
  const fileContent = matter.stringify(description || '', {
    title, category, prepTime, cookTime, yieldVal, ingredients, steps,
  });
  const filename = safeSlug ? `${safeSlug}.md` : `${safeTitle}.md`;
  await fs.writeFile(path.join(dataDir, filename), fileContent);
  return new Response(
    JSON.stringify({ success: true, slug: filename.replace('.md', '') }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
