// Local server for trying the app:  node serve.mjs  ->  http://localhost:5070
// Only this computer can open it (127.0.0.1). It sends the same security headers as the hosted site.
// Add ?local to the address to use the one-device version even when config.js points at the database.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbUrl, securityHeaders } from './tools/headers.mjs';

const rootUrl = new URL('.', import.meta.url);
const root = fileURLToPath(rootUrl);
const port = Number(process.env.PORT) || 5070;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const blocked = /(^|\/)(\.git|tools|supabase|node_modules)(\/|$)|\.(md|mjs|ps1|sql)$/i;

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const head = { ...securityHeaders(dbUrl(rootUrl)), 'Cache-Control': 'no-store' };
  const file = normalize(join(root, path));
  if (!file.startsWith(normalize(root)) || blocked.test(path)) { res.writeHead(403, head).end('Forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { ...head, 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404, head).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Community Club running at http://localhost:${port}`));
