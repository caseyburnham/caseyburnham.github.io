import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import Ajv from 'ajv';
import { formatElevation } from '../js/utils/exif-utils.js';
import { DataCache } from '../js/utils/data-cache.js';
import {
	fetchDiscogs,
	parseDiscogsPage,
	selectRandomPage
} from '../netlify/lib/discogs-utils.mjs';
import { isValidCalendarDate, isValidIsoDate } from '../js/utils/date-utils.js';

test('validates ISO calendar dates, including leap years', () => {
	assert.equal(isValidIsoDate('2024-02-29'), true);
	assert.equal(isValidIsoDate('2023-02-29'), false);
	assert.equal(isValidIsoDate('2026-04-31'), false);
	assert.equal(isValidIsoDate('2026-12-31'), true);
	assert.equal(isValidIsoDate('2026-2-03'), false);
});

test('formats sea-level elevation as a valid measurement', () => {
	assert.deepEqual(formatElevation(0), { display: '0 ft', feetRaw: 0 });
});

test('deduplicates in-flight data requests and caches their result', async () => {
	let requests = 0;
	const data = { value: 1 };
	const cache = new DataCache({
		fetchImpl: async () => {
			requests += 1;
			return new Response(JSON.stringify(data), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
	});

	const [first, second] = await Promise.all([
		cache.fetch('/data.json'),
		cache.fetch('/data.json')
	]);
	assert.equal(requests, 1);
	assert.strictEqual(first, second);
	assert.strictEqual(await cache.fetch('/data.json'), first);
});

test('bounds shared data request duration', async () => {
	const cache = new DataCache({
		fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => {
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		}),
		timeoutMs: 1
	});

	await assert.rejects(cache.fetch('/slow.json'), /Request for \/slow\.json failed/);
});

test('allows random selection of the final Discogs page', () => {
	assert.equal(selectRandomPage(3, () => 0), 1);
	assert.equal(selectRandomPage(3, () => 0.999), 3);
	assert.equal(selectRandomPage(0, () => 0.999), 1);
});

test('validates Discogs page envelopes', () => {
	assert.deepEqual(
		parseDiscogsPage({ pagination: { items: 1, pages: 2 }, releases: [{}] }, 'releases'),
		{ itemCount: 1, items: [{}], pageCount: 2 }
	);
	assert.throws(
		() => parseDiscogsPage({ pagination: { items: 1, pages: 2 } }, 'releases'),
		error => error.status === 502
	);
});

test('bounds Discogs request duration', async () => {
	const fetchImpl = async (url, { signal }) => new Promise((resolve, reject) => {
		signal.addEventListener('abort', () => reject(signal.reason), { once: true });
	});

	await assert.rejects(
		fetchDiscogs('/test', 'token', { fetchImpl, timeoutMs: 1 }),
		error => error.status === 504
	);
});

test('date schemas reject impossible calendar dates', async () => {
	const ajv = new Ajv();
	ajv.addFormat('date', { type: 'string', validate: isValidIsoDate });
	ajv.addKeyword({
		keyword: 'validCalendarDate',
		type: 'object',
		schemaType: 'boolean',
		validate: (enabled, value) => !enabled || isValidCalendarDate(value.year, value.month, value.day)
	});

	const [mountainSchema, gallerySchema, exifSchema] = await Promise.all([
		readFile(new URL('../schemas/mountain-data.schema.json', import.meta.url), 'utf8'),
		readFile(new URL('../schemas/gallery-data.schema.json', import.meta.url), 'utf8'),
		readFile(new URL('../schemas/exif-data.schema.json', import.meta.url), 'utf8')
	]);
	const validateMountains = ajv.compile(JSON.parse(mountainSchema));
	const validateGalleries = ajv.compile(JSON.parse(gallerySchema));
	const validateExif = ajv.compile(JSON.parse(exifSchema));
	const mountains = [{
		Peak: 'Test Peak',
		Elevation: '13,351',
		Range: 'Test Range',
		Date: '2023-02-29',
		Image: '/images/summits/test-peak.jpeg',
		ranked: true
	}];
	const galleries = {
		_config: { defaultGallery: 'test' },
		test: {
			name: 'Test',
			images: [{
				id: 'test-image',
				alt: 'Test image',
				title: 'Test Image',
				dateCreated: '2026-04-31',
				copyrightNotice: 'Casey Burnham',
				layout: 'landscape',
				sources: { jpeg: '/images/galleries/test/jpeg/test-image.jpeg' },
				thumbnail: '/images/galleries/test/thumbnails/test-image.jpeg'
			}]
		}
	};
	const exif = {
		'summits/test-peak.jpeg': {
			title: null,
			caption: null,
			copyright: 'Casey Burnham',
			cameraModel: 'Test Camera',
			iso: 100,
			lens: null,
			aperture: null,
			shutter: '1/100',
			exposureCompensation: '0',
			date: {
				_ctor: 'ExifDateTime',
				year: 2026,
				month: 4,
				day: 31,
				hour: 12,
				minute: 0,
				second: 0,
				tzoffsetMinutes: -360,
				rawValue: '2026:04:31 12:00:00',
				zoneName: 'America/Denver',
				inferredZone: false
			},
			format: 'JPEG'
		}
	};

	assert.equal(validateMountains(mountains), false);
	assert.equal(validateGalleries(galleries), false);
	assert.equal(validateExif(exif), false);
	mountains[0].Date = '2024-02-29';
	galleries.test.images[0].dateCreated = '2026-04-30';
	exif['summits/test-peak.jpeg'].date.day = 30;
	assert.equal(validateMountains(mountains), true);
	assert.equal(validateGalleries(galleries), true);
	assert.equal(validateExif(exif), true);
});
