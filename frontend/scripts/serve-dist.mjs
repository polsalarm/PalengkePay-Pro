import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const indexPath = join(root, 'index.html');
const host = readArg('--host') ?? '127.0.0.1';
const port = Number(readArg('--port') ?? process.env.PORT ?? 5173);
const indexHtml = existsSync(indexPath) ? readFileSync(indexPath) : null;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const candidate = normalize(join(root, decodedPath));
  if (candidate !== root && !candidate.startsWith(root + sep)) return indexPath;
  return candidate;
}

function serveFile(response, filePath) {
  const extension = extname(filePath);
  response.writeHead(200, {
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
    'Content-Type': contentTypes.get(extension) ?? 'application/octet-stream',
  });
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(500).end('Unable to read requested file.');
      return;
    }
    response.destroy();
  });
  response.on('error', () => stream.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

function serveIndex(response) {
  if (!indexHtml) {
    response.writeHead(404).end('dist/index.html not found. Run npm run build first.');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes.get('.html'),
  });
  response.end(indexHtml);
}

const server = createServer((request, response) => {
  if (!request.url || !['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    response.writeHead(405).end();
    return;
  }

  const requestedPath = safePath(request.url);
  const hasRequestedFile = existsSync(requestedPath) && statSync(requestedPath).isFile();

  if (request.method === 'HEAD') {
    response.writeHead(200).end();
    return;
  }

  if (hasRequestedFile) {
    serveFile(response, requestedPath);
    return;
  }

  serveIndex(response);
});

server.listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port}`);
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
