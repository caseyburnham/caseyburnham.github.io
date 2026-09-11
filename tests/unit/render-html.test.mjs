import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { renderDocument } from '../../scripts/render-html.mjs';

const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const hostileText = '<img src=x onerror="alert(1)"> & "quoted"';
const galleries = {
	_config: { defaultGallery: 'sample' },
	sample: { name: hostileText, images: [{
		id: 'sample', title: hostileText, alt: hostileText, layout: 'landscape',
		thumbnail: '/images/thumb.jpeg', thumbnailSources: { 320: '/images/thumb,small.jpeg', 720: '/images/thumb.jpeg' }, sources: { jpeg: '/images/full.jpeg' }, dateCreated: '2026-01-01'
	}] }
};

test('renders escaped content and serialized mountain relationships at build time', () => {
	const mountains = [
		{ Peak: 'One', Elevation: '14,000', Range: 'Front', Date: '2026-01-01', ranked: true, Image: '/images/one.jpeg' },
		{ Peak: 'Two', Elevation: '13,500', Range: 'Front', Date: '2026-01-01', ranked: true }
	];
	const html = renderDocument(source, [
		{ Production: hostileText, visible: true },
		{ Production: 'Private credit', visible: false }
	], [{ Headliner: hostileText, Venue: 'Red Rocks', Year: '2026' }], mountains, {}, galleries);
	const { document } = parseHTML(html);
	assert.equal(document.querySelector('#productions-table tbody th').textContent, hostileText);
	assert.equal(document.querySelectorAll('#productions-table tbody tr').length, 1);
	assert.equal(document.querySelectorAll('[onerror]').length, 0);
	assert.equal(document.querySelector('#galleries img').getAttribute('alt'), hostileText);
	assert.equal(document.querySelector('#galleries img').getAttribute('srcset'), '/images/thumb%2Csmall.jpeg 320w, /images/thumb.jpeg 720w');
	assert.equal(document.querySelector('#gallery-navigation a').textContent, hostileText);
	assert.equal(document.querySelector('#mountains .mtn-date').getAttribute('rowspan'), '2');
	assert.equal(document.querySelectorAll('#mountains .mtn-date').length, 1);
	assert.equal(document.querySelector('#thirteener-progress').getAttribute('value'), '1');
	assert.equal(document.querySelector('#fourteener-progress').getAttribute('value'), '1');
	assert.equal(document.querySelector('.mtn-elevation-data').getAttribute('value'), '14000');
	assert.equal(document.querySelector('.mtn-date time').getAttribute('datetime'), '2026-01-01');
	assert.equal(document.querySelector('.range-ridge-count').textContent, '2');
	assert.ok(document.querySelector('.range-ridge-line').getAttribute('points'));
	assert.equal(document.querySelector('.camera-link').getAttribute('href'), '/images/one.jpeg');
	assert.equal(document.querySelector('.photo-thumb').getAttribute('href'), '/images/full.jpeg');
	assert.equal(document.querySelector('#production-row-template'), null);
});
