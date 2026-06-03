// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';
import { sanitiseSlug } from '../../utils/slugUtils';

export async function POST({ request }: { request: Request }) {
  try {
    const { slug, photo, caption } = await request.json();
    const safeSlug = sanitiseSlug(slug ?? '');
    
    if (!safeSlug) {
      return new Response(JSON.stringify({ error: 'Invalid slug' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!photo || !photo.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'Photo is required and must be an image file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse base64 photo
    const match = photo.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Invalid photo format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const extension = mimeType === 'image/png' ? 'png' : 'jpg';

    // Unique filename: <slug>-<timestamp>.<ext>
    const timestamp = Date.now();
    const filename = `${safeSlug}-${timestamp}.${extension}`;
    const imagePathOnDisk = path.join(process.cwd(), 'data', 'diary', 'images', filename);

    // Ensure data/diary/images directory exists
    await fs.mkdir(path.dirname(imagePathOnDisk), { recursive: true });

    // Save decoded buffer
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(imagePathOnDisk, buffer);

    const relativeImagePath = `/images/diary/images/${filename}`;

    // Read or initialize the diary file: data/diary/<slug>.json
    const diaryDir = path.join(process.cwd(), 'data', 'diary');
    await fs.mkdir(diaryDir, { recursive: true });
    
    const diaryFilePath = path.join(diaryDir, `${safeSlug}.json`);
    let entries = [];
    
    try {
      const existingData = await fs.readFile(diaryFilePath, 'utf-8');
      entries = JSON.parse(existingData);
    } catch {
      // File doesn't exist, which is fine
    }

    // Add new entry to the diary
    const newEntry = {
      id: `${safeSlug}-${timestamp}`,
      imagePath: relativeImagePath,
      caption: caption || '',
      date: new Date().toISOString(),
    };
    
    entries.unshift(newEntry); // Newest first

    await fs.writeFile(diaryFilePath, JSON.stringify(entries, null, 2));

    return new Response(JSON.stringify({ success: true, entry: newEntry }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
