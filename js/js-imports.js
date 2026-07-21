import { initCandy } from './ui/candy.js';
import { initTables } from './ui/tables.js';

const MAP_STYLESHEET_URL =
	typeof __MAP_STYLESHEET_URL__ === 'string'
		? __MAP_STYLESHEET_URL__
		: '/css/dist/map.css';

initCandy();
initTables().catch(error => {
	console.error('Failed to initialize tables:', error);
});

let mapStylesheetPromise;

function loadMapStylesheet() {
	if (mapStylesheetPromise) return mapStylesheetPromise;

	mapStylesheetPromise = new Promise((resolve, reject) => {
		const stylesheet = document.createElement('link');
		stylesheet.rel = 'stylesheet';
		stylesheet.href = MAP_STYLESHEET_URL;
		stylesheet.addEventListener('load', resolve, { once: true });
		stylesheet.addEventListener('error', () => {
			stylesheet.remove();
			mapStylesheetPromise = undefined;
			reject(new Error('Failed to load the MapLibre stylesheet.'));
		}, { once: true });
		document.head.append(stylesheet);
	});

	return mapStylesheetPromise;
}

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
			const { initMountainChart } = await import('./ui/mountain-chart.js');
			await initMountainChart();
		}
	},
	{
		selector: '#map',
		load: async () => {
			const [{ initMap }] = await Promise.all([
				import('./map/map.js'),
				loadMapStylesheet()
			]);
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
