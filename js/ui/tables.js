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
const REQUIRED_TEMPLATES = ['production-row-template', 'mountain-row-template', 'summary-row-template', 'concert-row-template', 'table-tally-template'];

function validateTemplates() {
	const missing = REQUIRED_TEMPLATES.filter(id => !document.getElementById(id));
	if (missing.length > 0) {
		throw new Error(`Missing required templates: ${missing.join(', ')}`);
	}
}
async function loadAllData() {
	const [exifData, productions, mountains, concerts] = await Promise.all([
		dataCache.fetch('/json/exif-data.json'),
		dataCache.fetch('/json/production-data.json'),
		dataCache.fetch('/json/mountain-data.json'),
		dataCache.fetch('/json/concert-data.json')
	]);
	return {
		concerts,
		exifData,
		mountains,
		productions
	};
}
export async function initTables() {
	validateTemplates();
	const {
		concerts,
		exifData,
		mountains,
		productions
	} = await loadAllData();
	renderProductions(productions);
	renderConcerts(concerts);
	renderMountains(processMountains(mountains, exifData));
}
