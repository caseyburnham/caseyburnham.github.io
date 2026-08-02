import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { isValidCalendarDate, isValidIsoDate } from '../js/utils/date-utils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datasets = [
	'concert-data',
	'exif-data',
	'gallery-data',
	'mountain-data',
	'production-data'
];
const ajv = new Ajv({ allErrors: true });
ajv.addFormat('date', { type: 'string', validate: isValidIsoDate });
ajv.addKeyword({
	keyword: 'validCalendarDate',
	type: 'object',
	schemaType: 'boolean',
	validate: (enabled, value) => !enabled || isValidCalendarDate(value.year, value.month, value.day)
});
const data = new Map();
const failures = [];

async function readJson(filename) {
	return JSON.parse(await readFile(path.join(root, filename), 'utf8'));
}

for (const name of datasets) {
	try {
		const [schema, value] = await Promise.all([
			readJson(`schemas/${name}.schema.json`),
			readJson(`json/${name}.json`)
		]);
		const validate = ajv.compile(schema);
		data.set(name, value);

		if (!validate(value)) {
			for (const error of validate.errors) {
				failures.push(`json/${name}.json${error.instancePath || '/'} ${error.message}`);
			}
		}
	} catch (error) {
		failures.push(`${name}: ${error.message}`);
	}
}

const assetReferences = new Map();

function referenceAsset(url, source) {
	if (typeof url !== 'string' || !url.startsWith('/')) return;
	const pathname = url.split(/[?#]/, 1)[0];
	if (!pathname.startsWith('/images/') && !pathname.startsWith('/json/')) return;

	if (!assetReferences.has(pathname)) assetReferences.set(pathname, new Set());
	assetReferences.get(pathname).add(source);
}

const galleries = data.get('gallery-data');
if (galleries) {
	const galleryNames = Object.keys(galleries).filter(name => name !== '_config');
	if (!galleryNames.includes(galleries._config.defaultGallery)) {
		failures.push(`gallery-data: default gallery "${galleries._config.defaultGallery}" does not exist`);
	}

	for (const galleryName of galleryNames) {
		const ids = new Set();
		for (const image of galleries[galleryName].images) {
			if (ids.has(image.id)) {
				failures.push(`gallery-data: duplicate id "${image.id}" in ${galleryName}`);
			}
			ids.add(image.id);
			referenceAsset(image.thumbnail, `gallery ${galleryName}/${image.id}`);
			for (const source of Object.values(image.sources)) {
				referenceAsset(source, `gallery ${galleryName}/${image.id}`);
			}
		}
	}
}

for (const mountain of data.get('mountain-data') || []) {
	referenceAsset(mountain.Image, `mountain ${mountain.Peak}`);
}

for (const imagePath of Object.keys(data.get('exif-data') || {})) {
	referenceAsset(`/images/${imagePath}`, `EXIF ${imagePath}`);
}

try {
	const html = await readFile(path.join(root, 'index.html'), 'utf8');
	for (const match of html.matchAll(/(?:href|poster|src)="([^"\n]+)"/g)) {
		referenceAsset(match[1], 'index.html');
	}
} catch (error) {
	failures.push(`index.html: ${error.message}`);
}

try {
	const css = await readFile(path.join(root, 'css/components/_discogs.css'), 'utf8');
	for (const match of css.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/g)) {
		referenceAsset(match[2], 'css/components/_discogs.css');
	}
} catch (error) {
	failures.push(`css/components/_discogs.css: ${error.message}`);
}

for (const [url, sources] of assetReferences) {
	const filename = path.resolve(root, `.${url}`);
	if (!filename.startsWith(`${root}${path.sep}`)) {
		failures.push(`${url}: resolves outside the project`);
		continue;
	}

	try {
		await access(filename);
	} catch {
		failures.push(`${url}: missing (referenced by ${[...sources].join(', ')})`);
	}
}

if (failures.length > 0) {
	throw new Error(`Data validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${datasets.length} JSON datasets and ${assetReferences.size} asset references.`);
