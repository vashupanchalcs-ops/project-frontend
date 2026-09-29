/**
 * Aarogya Map Server — Dedicated static server for the live tracking map layer.
 * Serves everything under public/map/ on port 5200.
 * Handles any path → returns index.html (SPA-style fallback).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT    = Number(process.env.PORT) || 5200;
const MAP_DIR = path.join(__dirname, 'public', 'map');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

const server = http.createServer((req, res) => {
  // CORS — allow the Vite dev server (port 5173) and any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-Frame-Options', 'ALLOWALL');           // allow iframe embedding
  res.setHeader('Content-Security-Policy', "frame-ancestors *");

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Determine requested file (strip query string)
  const rawPath = req.url.split('?')[0];
  let filePath  = path.join(MAP_DIR, rawPath === '/' ? 'index.html' : rawPath);

  // Sanitize path traversal
  if (!filePath.startsWith(MAP_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // If file doesn't exist → serve index.html (single-page fallback)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(MAP_DIR, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚑  Aarogya Map Server running at http://127.0.0.1:${PORT}`);
  console.log(`    Serving: ${MAP_DIR}`);
  console.log(`    Embed via React iframe: http://127.0.0.1:${PORT}/?booking_id=<ID>&email=<EMAIL>\n`);
});
