import {
	initCandy
}
from './ui/candy.js';
import {
	initTables
}
from './ui/tables.js';
import {
	PhotoModal
}
from './modal/modal.js';
import {
	getPhotoRoute,
	setPhotoRoute
}
from './utils/gallery-route.js';
const MAP_STYLESHEET_URL = typeof __MAP_STYLESHEET_URL__ === 'string' ? __MAP_STYLESHEET_URL__ : '/css/dist/map.css';
initCandy();
const tablesReady = initTables()
	.catch(error => {
		console.error('Failed to initialize tables:', error);
	});
// Summit buttons are populated separately from the lazy gallery. Initialize the
// shared viewer now so either image collection can open it first.
const photoModal = new PhotoModal();
const photoModalReady = photoModal.initialize();
void photoModalReady.catch(error => {
	console.error('Failed to initialize the photo viewer:', error);
});
let mapStylesheetPromise;
let galleriesPromise;
let applyingGalleryRoute = false;
let routeVersion = 0;
const galleryError = document.getElementById('gallery-error');
const galleryRetry = document.getElementById('gallery-retry');

function loadMapStylesheet() {
	if (mapStylesheetPromise) return mapStylesheetPromise;
	mapStylesheetPromise = new Promise((resolve, reject) => {
		const stylesheet = document.createElement('link');
		stylesheet.rel = 'stylesheet';
		stylesheet.href = MAP_STYLESHEET_URL;
		stylesheet.addEventListener('load', resolve, {
			once: true
		});
		stylesheet.addEventListener('error', () => {
			stylesheet.remove();
			mapStylesheetPromise = undefined;
			reject(new Error('Failed to load the MapLibre stylesheet.'));
		}, {
			once: true
		});
		document.head.append(stylesheet);
	});
	return mapStylesheetPromise;
}
// Lazy-loaded features
const lazyFeatures = [{
	selector: '#galleries',
	load: async () => {
		if (!galleriesPromise) {
			galleryRetry.disabled = true;
			galleriesPromise = Promise.all([
				import('./ui/galleries.js'),
				photoModalReady
			])
				.then(async ([{
					Galleries
				}]) => {
					const galleries = new Galleries();
					await galleries.init();
					galleryError.hidden = true;
					return galleries;
				})
				.catch(error => {
					galleriesPromise = undefined;
					galleryError.hidden = false;
					throw error;
				})
				.finally(() => { galleryRetry.disabled = false; });
		}
		await galleriesPromise;
	}
}, {
	selector: '#map',
	load: async () => {
		const [{
			initMap
		}] = await Promise.all([
			import('./map/map.js'),
			loadMapStylesheet()
		]);
		await initMap();
	}
}, {
	selector: '#now-playing',
	load: async () => {
		const {
			initDiscogs
		} = await import('./ui/discogs-display.js');
		await initDiscogs();
	}
}];
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
}, {
	rootMargin: '200px 0px 200px 0px'
});
async function loadFeature(feature, element) {
	try {
		await feature.load();
		observer.unobserve(element);
	}
	catch (error) {
		console.error(`Failed to load ${feature.selector}:`, error);
	}
	finally {
		loadingElements.delete(element);
	}
}
for (const feature of lazyFeatures) {
	const element = document.querySelector(feature.selector);
	if (!element) continue;
	featureByElement.set(element, feature);
	observer.observe(element);
}

galleryRetry.addEventListener('click', async () => {
	await loadFeature(lazyFeatures[0], document.getElementById('galleries'));
	if (galleriesPromise) await applyPhotoRoute();
});

async function applyPhotoRoute({
	withTransition = false
} = {}) {
	const version = ++routeVersion;
	const route = getPhotoRoute();
	applyingGalleryRoute = false;
	if (!route) {
		photoModal.close();
		return;
	}
	if (route.section === 'mountains') {
		applyingGalleryRoute = true;
		try {
			await Promise.all([tablesReady, photoModalReady]);
			if (version !== routeVersion) return;
			if (!route.photo) {
				photoModal.close();
				return;
			}
			document.querySelector(`#mountains .camera-link[data-photo-id="${CSS.escape(route.photo)}"]`)
				?.click();
		}
		finally {
			if (version === routeVersion) applyingGalleryRoute = false;
		}
		return;
	}
	const galleriesElement = document.querySelector('#galleries');
	const feature = featureByElement.get(galleriesElement);
	if (!feature) return;
	applyingGalleryRoute = true;
	try {
		await loadFeature(feature, galleriesElement);
		const galleries = await galleriesPromise;
		if (!galleries || version !== routeVersion) return;
		if (!route.photo) photoModal.close();
		galleries.applyRoute(route, {
			withTransition
		});
	}
	finally {
		if (version === routeVersion) applyingGalleryRoute = false;
	}
}

document.addEventListener('gallerychange', event => {
	if (applyingGalleryRoute) return;
	setPhotoRoute({
		section: 'galleries',
		...event.detail
	});
});
document.addEventListener('photochange', event => {
	if (applyingGalleryRoute) return;
	const current = getPhotoRoute();
	if (!event.detail.photo && !current) return;
	setPhotoRoute({
		section: event.detail.section || current?.section,
		gallery: event.detail.gallery || current?.gallery,
		photo: event.detail.photo
	}, {
		replace: !event.detail.photo
	});
});
window.addEventListener('hashchange', () => applyPhotoRoute({
	withTransition: true
}));
// Hash changes also cover history traversal between photo routes.
void applyPhotoRoute();
