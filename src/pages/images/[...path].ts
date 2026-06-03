import fs from 'fs/promises';
import path from 'path';

export async function GET({ params }: { params: { path: string } }) {
  const imagePath = params.path;
  if (!imagePath) {
    return new Response(null, { status: 400 });
  }

  // Prevent directory traversal
  const safePath = path.normalize(imagePath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  const fullPath = path.join(process.cwd(), 'data', 'recipes', safePath);

  try {
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.svg') mimeType = 'image/svg+xml';

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error) {
    // Fallback to checking the legacy public/images directory
    const legacyPath = path.join(process.cwd(), 'public', 'images', safePath);
    try {
      const data = await fs.readFile(legacyPath);
      const ext = path.extname(legacyPath).toLowerCase();
      
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.svg') mimeType = 'image/svg+xml';

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    } catch (fallbackError) {
      return new Response(null, { status: 404 });
    }
  }
}
