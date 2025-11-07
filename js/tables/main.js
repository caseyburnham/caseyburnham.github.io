// tables/main.js
import { ui } from './ui.js';
import { dataService, processProductionsData, processMountainsData } from './data-processor.js';

async function init() {
	const { productions, mountains, concerts, exifData } = await dataService.getAllData();

	const processedProductions = processProductionsData(productions);
	const processedMountains = processMountainsData(mountains, exifData);

	if (processedProductions) ui.renderProductions(processedProductions);
	if (concerts) ui.renderConcerts(concerts);
	if (processedMountains) ui.renderMountains(processedMountains);

	ui.highlightVenues();
}

// Wait for DOM properly
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}