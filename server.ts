import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import app, { bootstrap } from './server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const distPath = path.resolve(process.cwd(), 'dist');

// Bootstrap data seeding, calibration models, and active background ticking loops
bootstrap();

if (fs.existsSync(distPath)) {
  console.log('[Production Server] Static assets found. Actively serving dist directory.');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('[Production Server WARNING] No compiled static client folder found in /dist. API routes will be active only.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Production Server] NGX Prediction Research Platform running on port ${PORT}`);
});
