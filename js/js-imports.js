import { initCandy } from './ui/candy.js';
import { initTables } from './ui/tables.js';

initCandy();
initTables().catch(error => {
	console.error('Failed to initialize tables:', error);
});

// Lazy-loaded features
const lazyFeatures = [
	{
		selector: '#galleries',
		load: async () => {
			const [{ PhotoModal }, { Galleries }] = await Promise.all([
				import('./modal/modal.js'),
				import('./ui/galleries.js')
			]);
			const photoModal = new PhotoModal();
			await photoModal.initialize();

			try {
				const galleries = new Galleries();
				await galleries.init();
			} catch (error) {
				photoModal.destroy();
				throw error;
			}
		}
	},
	{
		selector: '#tables',
		load: async () => {
			await import('https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js');
			const { initMountainChart } = await import('./ui/mountain-chart.js');
			await initMountainChart();
		}
	},
	{
		selector: '#map',
		load: async () => {
			await import('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js');
			const { initMap } = await import('./map/map.js');
			await initMap();
		}
	},
	{
		selector: '#now-playing',
		load: async () => {
			const { initDiscogs } = await import('./ui/discogs-display.js');
			await initDiscogs();
		}
	}
];

const featureByElement = new Map();
const loadingElements = new WeakSet();

const observer = new IntersectionObserver((entries) => {
	for (const entry of entries) {
		if (!entry.isIntersecting || loadingElements.has(entry.target)) continue;

		const feature = featureByElement.get(entry.target);
		if (!feature) continue;

		loadingElements.add(entry.target);
		loadFeature(feature, entry.target);
	}
}, { rootMargin: '200px 0px 200px 0px' });

async function loadFeature(feature, element) {
	try {
		await feature.load();
		observer.unobserve(element);
	} catch (error) {
		console.error(`Failed to load ${feature.selector}:`, error);
	} finally {
		loadingElements.delete(element);
	}
}

for (const feature of lazyFeatures) {
	const element = document.querySelector(feature.selector);
	if (!element) continue;

	featureByElement.set(element, feature);
	observer.observe(element);
}
