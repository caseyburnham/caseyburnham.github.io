import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
	access,
	cp,
	mkdir,
	readFile,
	rename,
	rm,
	writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { build as bundle } from 'esbuild';
import postcss from 'postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const staging = path.join(root, 'build');
const previousDist = path.join(root, '.dist-previous');
const assets = path.join(staging, 'assets');
const cssEntries = {
	main: {
		source: path.join(root, 'css/main/_imports.css'),
		prefix: 'style'
	},
	map: {
		source: path.join(root, 'css/maps/_imports.css'),
		prefix: 'map'
	}
};
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const postcssConfig = require('../config/postcss.config.cjs');
const sitemapInputs = ['index.html', 'css', 'js', 'json', 'images'];
const sitemapTimeZone = 'America/Denver';

const toPosix = value => value.split(path.sep).join('/');
const hash = value =>
	createHash('sha256').update(value).digest('hex').slice(0, 12);

function shouldCopy(source) {
	const segments = path.relative(root, source).split(path.sep);
	return !segments.includes('.DS_Store') && !segments.includes('ORIGINALS');
}

async function compileStylesheet({ source: entry, prefix }) {
	const source = await readFile(entry, 'utf8');
	const result = await postcss(postcssConfig.plugins).process(source, {
		from: entry,
		map: false
	});
	const filename = `${prefix}-${hash(result.css)}.css`;

	await writeFile(path.join(assets, filename), result.css);

	return `/assets/${filename}`;
}

async function compileStylesheets() {
	const [css, mapCss] = await Promise.all([
		compileStylesheet(cssEntries.main),
		compileStylesheet(cssEntries.map)
	]);

	return { css, mapCss };
}

async function bundleJavaScript(mapCss) {
	const result = await bundle({
		absWorkingDir: root,
		entryPoints: { main: 'js/js-imports.js' },
		outdir: assets,
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
		logLevel: 'info',
		define: {
			__MAP_STYLESHEET_URL__: JSON.stringify(mapCss)
		}
	});

	const entry = Object.entries(result.metafile.outputs).find(
		([, output]) => output.entryPoint === 'js/js-imports.js'
	);
	if (!entry) {
		throw new Error('JavaScript entry point was not emitted.');
	}

	const emittedPath = path.isAbsolute(entry[0])
		? entry[0]
		: path.resolve(root, entry[0]);
	return `/${toPosix(path.relative(staging, emittedPath))}`;
}

async function writeHtml({ css, js }) {
	const source = await readFile(path.join(root, 'index.html'), 'utf8');
	const html = source
		.replaceAll('href="js/dist/main.js"', `href="${js}"`)
		.replace('href="css/dist/style.css"', `href="${css}"`)
		.replace('src="js/dist/main.js"', `src="${js}"`);

	if (html === source) {
		throw new Error('Build asset references were not updated in index.html.');
	}

	await writeFile(path.join(staging, 'index.html'), html);
}

function getCurrentSitemapDate() {
	const parts = new Intl.DateTimeFormat('en-US', {
		day: '2-digit',
		month: '2-digit',
		timeZone: sitemapTimeZone,
		year: 'numeric'
	}).formatToParts();
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}`;
}

async function getSitemapDate(existingDate) {
	try {
		const { stdout: status } = await execFileAsync(
			'git',
			['status', '--porcelain', '--untracked-files=normal', '--', ...sitemapInputs],
			{ cwd: root }
		);

		if (status.trim()) return getCurrentSitemapDate();

		const { stdout: commitDate } = await execFileAsync(
			'git',
			['log', '-1', '--format=%cI', '--', ...sitemapInputs],
			{ cwd: root }
		);
		const committedDate = commitDate.trim().slice(0, 10);
		return [existingDate, committedDate].filter(Boolean).sort().at(-1);
	} catch {
		return existingDate || getCurrentSitemapDate();
	}
}

async function writeSitemap() {
	const filename = path.join(root, 'sitemap.xml');
	const source = await readFile(filename, 'utf8');
	const existingDate = source.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/)?.[1];
	const lastModified = await getSitemapDate(existingDate);
	const sitemap = source.replace(
		/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/,
		`<lastmod>${lastModified}</lastmod>`
	);

	if (sitemap === source && !existingDate) {
		throw new Error('sitemap.xml is missing a valid <lastmod> value.');
	}

	await writeFile(path.join(staging, 'sitemap.xml'), sitemap);
}

async function copyStaticFiles() {
	await Promise.all([
		cp(path.join(root, 'images'), path.join(staging, 'images'), {
			recursive: true,
			filter: shouldCopy
		}),
		cp(path.join(root, 'json'), path.join(staging, 'json'), {
			recursive: true,
			filter: shouldCopy
		}),
		...['_headers', 'robots.txt'].map(filename =>
			cp(path.join(root, filename), path.join(staging, filename))
		)
	]);
}

async function pathExists(filename) {
	try {
		await access(filename);
		return true;
	} catch {
		return false;
	}
}

async function publishBuild() {
	const hasExistingDist = await pathExists(dist);
	if (hasExistingDist) {
		await rm(previousDist, { force: true, recursive: true });
		await rename(dist, previousDist);
	}

	try {
		await rename(staging, dist);
	} catch (error) {
		if (hasExistingDist) await rename(previousDist, dist);
		throw error;
	}

	await rm(previousDist, { force: true, recursive: true });
}

async function main() {
	await rm(staging, { force: true, recursive: true });
	await mkdir(assets, { recursive: true });

	try {
		const { css, mapCss } = await compileStylesheets();
		const js = await bundleJavaScript(mapCss);

		await Promise.all([
			writeHtml({ css, js }),
			copyStaticFiles(),
			writeSitemap(),
			writeFile(
				path.join(staging, 'asset-manifest.json'),
				`${JSON.stringify({ css, mapCss, js }, null, 2)}\n`
			)
		]);

		await publishBuild();

		console.log(
			`Built ${path.relative(root, dist)} with ${css}, ${mapCss}, and ${js}`
		);
	} catch (error) {
		await rm(staging, { force: true, recursive: true });
		throw error;
	}
}

await main();
