/** Coordinate data loading for the production, mountain, and concert tables. */
import dataCache from '../utils/data-cache.js';
import {
	renderConcerts
}
from './tables/concert-table.js';
import {
	processMountains,
	renderMountains
}
from './tables/mountain-table.js';
import {
	renderProductions
}
from './tables/production-table.js';
const REQUIRED_TEMPLATES = ['production-row-template', 'mountain-row-template', 'summary-row-template', 'concert-row-template', 'table-tally-template', 'range-ridge-template'];

function validateTemplates() {
	const missing = REQUIRED_TEMPLATES.filter(id => !document.getElementById(id));
	if (missing.length > 0) {
		throw new Error(`Missing required templates: ${missing.join(', ')}`);
	}
}
async function renderTable(id, load, render) {
	try {
		render(await load());
	}
	catch (error) {
		console.error(`Failed to load ${id}:`, error);
		const status = document.createElement('p');
		status.role = 'status';
		status.textContent = 'This table could not be loaded. Please reload to try again.';
		document.getElementById(id)?.before(status);
	}
}

export async function initTables() {
	validateTemplates();
	await Promise.all([
		renderTable('productions-table', () => dataCache.fetch('/json/production-data.json'), renderProductions),
		renderTable('concerts', () => dataCache.fetch('/json/concert-data.json'), renderConcerts),
		renderTable('mountains', async () => {
			const [mountains, exif] = await Promise.all([
				dataCache.fetch('/json/mountain-data.json'),
				dataCache.fetch('/json/exif-data.json').catch(() => ({}))
			]);
			return processMountains(mountains, exif);
		}, renderMountains)
	]);
}
