import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addCorsHeaders } from './lib/shared.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Serve HTML files from logistics folder
  const filePath = req.url;
  
  // Map root requests to auth.html
  if (filePath === '/' || filePath === '') {
    const authPath = path.join(__dirname, '..', 'logistics', 'auth.html');
    try {
      const content = fs.readFileSync(authPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(content);
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }
  }

  // Serve other HTML/static files
  if (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js')) {
    const logisticsPath = path.join(__dirname, '..', 'logistics', filePath);
    try {
      const content = fs.readFileSync(logisticsPath, 'utf-8');
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript'
      };
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
      return res.status(200).send(content);
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }
  }

  res.status(404).json({ error: 'Not found' });
};
