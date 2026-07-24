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
const [sourceSitemap, builtSitemap] = await Promise.all([
	readFile(path.join(root, 'sitemap.xml'), 'utf8'),
	readFile(path.join(dist, 'sitemap.xml'), 'utf8')
]);
const javascript = await readFile(
	path.join(dist, manifest.js.replace(/^\//, '')),
	'utf8'
);
const [criticalCss, mapCss] = await Promise.all([
	readFile(path.join(dist, manifest.css.replace(/^\//, '')), 'utf8'),
	readFile(path.join(dist, manifest.mapCss.replace(/^\//, '')), 'utf8')
]);

for (const [type, url] of Object.entries(manifest)) {
	const patterns = {
		css: /^\/assets\/style-[a-f0-9]{12}\.css$/,
		mapCss: /^\/assets\/map-[a-f0-9]{12}\.css$/,
		js: /^\/assets\/main-[A-Z0-9]+\.js$/
	};

	if (!patterns[type]?.test(url)) {
		throw new Error(`Unexpected ${type} asset name: ${url}`);
	}
	await access(path.join(dist, url));
}

if (!html.includes(manifest.css) || !html.includes(manifest.js)) {
	throw new Error('Generated HTML does not reference its critical assets.');
}
if (html.includes(manifest.mapCss) || !javascript.includes(manifest.mapCss)) {
	throw new Error('Map CSS is not referenced exclusively by the lazy loader.');
}
if (
	criticalCss.includes('.maplibregl-') ||
	!mapCss.includes('.maplibregl-map') ||
	!mapCss.includes('.map-marker')
) {
	throw new Error('MapLibre CSS was not isolated in the lazy stylesheet.');
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

if (
	sourceSitemap !== builtSitemap ||
	!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(builtSitemap)
) {
	throw new Error('Generated sitemap is stale or has an invalid lastmod date.');
}

console.log('Build artifact checks passed.');
