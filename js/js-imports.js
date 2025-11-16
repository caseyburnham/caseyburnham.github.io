// Imports
import dataCache from './utils/shared-data.js';
import '/js/ui/candy.js';
import '/js/ui/tables.js';

// Lazy-loaded features
const lazyFeatures = [
	{ 
		selector: '#climbing-map', 
		scripts: ['/js/map/map.js'] 
	},
	{ 
		selector: '#now-playing', 
		scripts: ['/js/ui/discogs-display.js'] 
	},
	{
		selector: '#galleries',
		scripts: ['/js/modal/modal.js', '/js/ui/galleries.js'],
		init: async () => {
			const { PhotoModal } = await import('./modal/modal.js');
			const photoModal = new PhotoModal();
			await photoModal.initialize();
			window.photoModal = photoModal;
		}
	}
];

// Intersection observer for lazy loading
const observer = new IntersectionObserver((entries) => {
	entries.forEach(async (entry) => {
		if (!entry.isIntersecting) return;

		const feature = lazyFeatures.find(f => entry.target.matches(f.selector));
		if (!feature) return;

		try {
			// Load scripts
			for (const script of feature.scripts) {
				await import(script);
			}

			// Run init if provided
			if (feature.init) {
				await feature.init();
			}

			observer.unobserve(entry.target);
		} catch (err) {
			console.error(`Failed to load ${feature.selector}:`, err);
		}
	});
}, { rootMargin: '200px 0px 200px 0px' });

// Observe feature elements
lazyFeatures.forEach(feature => {
	const element = document.querySelector(feature.selector);
	if (element) observer.observe(element);
});

// Cleanup
window.addEventListener('beforeunload', () => {
	window.photoModal?.destroy();
	window.Galleries?.destroy();
	dataCache.clear();
});