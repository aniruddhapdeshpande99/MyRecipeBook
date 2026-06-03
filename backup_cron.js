import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

function cleanOldBackups(backupDir) {
  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;

  files.forEach(file => {
    if (file.startsWith('recipes-backup-') && file.endsWith('.zip')) {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > fourteenDays) {
        fs.unlinkSync(filePath);
        console.log(`[Backup] Deleted old backup: ${file}`);
      }
    }
  });
}

// Run every day at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  console.log('[Backup] Starting daily recipe markdown backup...');
  
  const dataDir = path.join(process.cwd(), 'data', 'recipes');
  const backupDir = path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const zipPath = path.join(backupDir, `recipes-backup-${dateStr}.zip`);
  
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`[Backup] Finished! ${archive.pointer()} total bytes.`);
    cleanOldBackups(backupDir);
  });

  archive.on('error', (err) => {
    console.error('[Backup] Error:', err);
  });

  archive.pipe(output);

  // Recursively find only .md files
  async function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== 'miseenplace') {
          await walk(fullPath);
        }
      } else if (file.endsWith('.md')) {
        // Add to zip, preserving relative path from dataDir
        const relativePath = path.relative(dataDir, fullPath);
        archive.file(fullPath, { name: relativePath });
      }
    }
  }

  if (fs.existsSync(dataDir)) {
    await walk(dataDir);
  }
  
  await archive.finalize();
});

console.log('[Backup] Cron scheduled for 3:00 AM daily (Markdown only).');
