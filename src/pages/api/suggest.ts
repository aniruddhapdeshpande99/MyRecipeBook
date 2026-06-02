// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';

export async function POST({ request }: { request: Request }) {
  let body: { name?: string; email?: string; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name = '', email = '', message = '' } = body;
  if (!name.trim() || !email.trim() || !message.trim()) {
    return new Response(JSON.stringify({ error: 'All fields required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (message.length > 2000) {
    return new Response(JSON.stringify({ error: 'Message too long (max 2000 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  const entry = `\n--- ${new Date().toISOString()} ---\nFrom: ${name} <${email}>\n${message}\n`;
  await fs.appendFile(path.join(dataDir, 'suggestions.log'), entry, 'utf-8');

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
