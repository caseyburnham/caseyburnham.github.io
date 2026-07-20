import { createHash } from 'node:crypto';
import {
	cp,
	mkdir,
	readFile,
	rm,
	writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build as bundle } from 'esbuild';
import postcss from 'postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');
const cssEntry = path.join(root, 'css/main/_imports.css');
const legacyCss = path.join(root, 'css/dist/style.css');
const require = createRequire(import.meta.url);
const postcssConfig = require('../utility/postcss.config.js');

const toPosix = value => value.split(path.sep).join('/');
const hash = value =>
	createHash('sha256').update(value).digest('hex').slice(0, 12);

function shouldCopy(source) {
	const segments = path.relative(root, source).split(path.sep);
	return !segments.includes('.DS_Store') && !segments.includes('ORIGINALS');
}

async function compileCss() {
	const source = await readFile(cssEntry, 'utf8');
	const result = await postcss(postcssConfig.plugins).process(source, {
		from: cssEntry,
		map: false
	});
	const filename = `style-${hash(result.css)}.css`;

	await mkdir(path.dirname(legacyCss), { recursive: true });
	await Promise.all([
		writeFile(path.join(assets, filename), result.css),
		writeFile(legacyCss, result.css)
	]);

	return `/assets/${filename}`;
}

async function bundleJavaScript() {
	const result = await bundle({
		absWorkingDir: root,
		entryPoints: { main: 'js/js-imports.js' },
		outdir: 'dist/assets',
		entryNames: '[name]-[hash]',
		chunkNames: 'chunks/chunk-[hash]',
		assetNames: 'media/[name]-[hash]',
		bundle: true,
		format: 'esm',
		splitting: true,
		minify: true,
		metafile: true,
		sourcemap: false,
		target: ['es2022'],
		logLevel: 'info'
	});

	const entry = Object.entries(result.metafile.outputs).find(
		([, output]) => output.entryPoint === 'js/js-imports.js'
	);
	if (!entry) {
		throw new Error('JavaScript entry point was not emitted.');
	}

	return `/${toPosix(entry[0]).replace(/^dist\//, '')}`;
}

async function writeHtml({ css, js }) {
	const source = await readFile(path.join(root, 'index.html'), 'utf8');
	const html = source
		.replaceAll('href="js/js-imports.js"', `href="${js}"`)
		.replace('href="css/dist/style.css"', `href="${css}"`)
		.replace('src="js/js-imports.js"', `src="${js}"`);

	if (html === source) {
		throw new Error('Build asset references were not updated in index.html.');
	}

	await writeFile(path.join(dist, 'index.html'), html);
}

async function copyStaticFiles() {
	await Promise.all([
		cp(path.join(root, 'images'), path.join(dist, 'images'), {
			recursive: true,
			filter: shouldCopy
		}),
		cp(path.join(root, 'json'), path.join(dist, 'json'), {
			recursive: true,
			filter: shouldCopy
		}),
		...['_headers', 'robots.txt', 'sitemap.xml'].map(filename =>
			cp(path.join(root, filename), path.join(dist, filename))
		)
	]);
}

async function main() {
	await rm(dist, { force: true, recursive: true });
	await mkdir(assets, { recursive: true });

	const [css, js] = await Promise.all([
		compileCss(),
		bundleJavaScript()
	]);

	await Promise.all([
		writeHtml({ css, js }),
		copyStaticFiles(),
		writeFile(
			path.join(dist, 'asset-manifest.json'),
			`${JSON.stringify({ css, js }, null, 2)}\n`
		)
	]);

	console.log(`Built ${path.relative(root, dist)} with ${css} and ${js}`);
}

await main();
