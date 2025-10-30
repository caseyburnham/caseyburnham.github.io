import { dataService } from './dataService.js';
import { ui } from './ui.js';
class App {
	constructor() {
		this.init();
	}

	async init() {
		const { productions, mountains, concerts, exifData } = await dataService.getAllData();

		if (productions) ui.renderProductions(productions);
		if (concerts) ui.renderConcerts(concerts);
		if (mountains) ui.renderMountains(mountains, exifData);

		ui.highlightVenues();
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => new App());
} else {
	new App();
}