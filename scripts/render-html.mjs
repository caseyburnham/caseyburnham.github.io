import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { renderProductions } from './renderers/production-table.mjs';
import { renderConcerts } from './renderers/concert-table.mjs';
import { processMountains, renderMountains } from './renderers/mountain-table.mjs';
import { createPhotoGrids } from '../shared/gallery-render.js';

export async function renderHtml(source, root) {
	const datasets = await Promise.all(['production', 'concert', 'mountain', 'exif', 'gallery'].map(async name =>
		JSON.parse(await readFile(path.join(root, 'json', `${name}-data.json`), 'utf8'))));
	return renderDocument(source, ...datasets);
}

export function renderDocument(source, productions, concerts, mountains, exif, galleries) {
	const { document } = parseHTML(source);
	renderProductions(document, productions);
	renderConcerts(document, concerts);
	renderMountains(document, processMountains(mountains, exif));

	const entries = Object.entries(galleries).filter(([key]) => key !== '_config');
	if (!entries.length) throw new Error('At least one gallery is required.');
	const defaultKey = entries.some(([key]) => key === galleries._config?.defaultGallery)
		? galleries._config.defaultGallery : entries[0][0];
	const section = document.getElementById('galleries');
	section.dataset.gallery = defaultKey;
	section.append(createPhotoGrids(document, galleries[defaultKey].images, defaultKey));

	const controls = document.getElementById('gallery-controls-template').content.firstElementChild.cloneNode(true);
	controls.hidden = true;
	const buttons = controls.querySelector('.gallery-buttons');
	const menu = document.getElementById('gallery-nav-menu-template').content.firstElementChild.cloneNode(true);
	entries.forEach(([key, gallery], index) => {
		const button = document.getElementById('gallery-button-template').content.firstElementChild.cloneNode(true);
		button.disabled = true;
		button.dataset.gallery = key;
		button.textContent = gallery.name || key;
		button.setAttribute('aria-pressed', String(key === defaultKey));
		button.classList.toggle('selected', key === defaultKey);
		buttons.append(button);
		const item = document.getElementById('gallery-nav-link-template').content.firstElementChild.cloneNode(true);
		item.style.setProperty('--i', index);
		const link = item.querySelector('a');
		link.dataset.gallery = key;
		link.setAttribute('href', `#galleries?gallery=${encodeURIComponent(key)}`);
		link.textContent = gallery.name || key;
		menu.append(item);
	});
	section.querySelector('.photo-grid').before(controls);
	document.querySelector('nav a[href="#galleries"]').parentElement.append(menu);
	const year = document.getElementById('copyright-year');
	year.textContent = new Date().getFullYear();
	year.setAttribute('datetime', year.textContent);

	for (const id of ['production-row', 'mountain-row', 'summary-row', 'concert-row', 'table-tally', 'range-ridge', 'gallery-controls', 'gallery-button', 'gallery-nav-menu', 'gallery-nav-link']) {
		document.getElementById(`${id}-template`).remove();
	}
	return document.toString();
}
