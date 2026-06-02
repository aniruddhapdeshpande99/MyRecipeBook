import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { sanitiseSlug } from '../../utils/slugUtils';

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const rawSlug = url.searchParams.get('slug') || '';
  const slug = sanitiseSlug(rawSlug);

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Invalid slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filePath = path.join(process.cwd(), 'data', 'recipes', `${slug}.md`);

  if (!fsSync.existsSync(filePath)) {
    return new Response(JSON.stringify({ error: 'Recipe not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const content = await fs.readFile(filePath, 'utf-8');
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.md"`,
    },
  });
}
