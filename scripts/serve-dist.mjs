import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number.parseInt(process.env.PORT || '4175', 10);
const mimeTypes = new Map([
	['.avif', 'image/avif'],
	['.css', 'text/css; charset=utf-8'],
	['.html', 'text/html; charset=utf-8'],
	['.jpeg', 'image/jpeg'],
	['.jpg', 'image/jpeg'],
	['.js', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.png', 'image/png'],
	['.svg', 'image/svg+xml'],
	['.xml', 'application/xml; charset=utf-8']
]);

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url, `http://${request.headers.host}`);
		const pathname = decodeURIComponent(url.pathname);
		const requestedPath = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);

		if (requestedPath !== root && !requestedPath.startsWith(`${root}${path.sep}`)) {
			response.writeHead(403).end('Forbidden');
			return;
		}

		const file = await stat(requestedPath);
		if (!file.isFile()) throw new Error('Not a file');

		response.writeHead(200, {
			'Content-Length': file.size,
			'Content-Type': mimeTypes.get(path.extname(requestedPath)) || 'application/octet-stream'
		});
		createReadStream(requestedPath).pipe(response);
	} catch {
		response.writeHead(404).end('Not found');
	}
});

server.listen(port, '127.0.0.1', () => {
	console.log(`Serving dist at http://127.0.0.1:${port}`);
});
