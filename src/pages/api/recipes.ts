import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

export async function GET({ request }) {
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });
  
  const files = await fs.readdir(dataDir);
  const recipes = await Promise.all(files.filter(f => f.endsWith('.md')).map(async f => {
    const raw = await fs.readFile(path.join(dataDir, f), 'utf-8');
    const parsed = matter(raw);
    return { slug: f.replace('.md', ''), ...parsed.data, content: parsed.content };
  }));
  
  return new Response(JSON.stringify(recipes), { status: 200 });
}

export async function POST({ request }) {
  const data = await request.json();
  const { slug, title, category, ingredients, steps, description } = data;
  
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  await fs.mkdir(dataDir, { recursive: true });
  
  const fileContent = matter.stringify(description || '', { title, category, ingredients, steps });
  const filename = slug ? `${slug}.md` : `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
  
  await fs.writeFile(path.join(dataDir, filename), fileContent);
  return new Response(JSON.stringify({ success: true, slug: filename.replace('.md', '') }), { status: 200 });
}
