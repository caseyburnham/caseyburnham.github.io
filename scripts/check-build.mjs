import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const manifest = JSON.parse(
	await readFile(path.join(dist, 'asset-manifest.json'), 'utf8')
);
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const headers = await readFile(path.join(dist, '_headers'), 'utf8');

for (const [type, url] of Object.entries(manifest)) {
	const pattern = type === 'css'
		? /^\/assets\/style-[a-f0-9]{12}\.css$/
		: /^\/assets\/main-[A-Z0-9]+\.js$/;

	if (!pattern.test(url)) {
		throw new Error(`Unexpected ${type} asset name: ${url}`);
	}
	if (!html.includes(url)) {
		throw new Error(`Generated HTML does not reference ${url}`);
	}
	await access(path.join(dist, url));
}

for (const pathname of [
	'images/posters/jpeg/casey-rocky.jpeg',
	'json/gallery-data.json',
	'robots.txt',
	'sitemap.xml'
]) {
	await access(path.join(dist, pathname));
}

if (!headers.includes('/assets/*') || !headers.includes('immutable')) {
	throw new Error('Hashed assets are missing their immutable cache policy.');
}

if (/unpkg\.com|cdn\.jsdelivr\.net/.test(html)) {
	throw new Error('Generated HTML still depends on a package CDN.');
}

console.log('Build artifact checks passed.');
