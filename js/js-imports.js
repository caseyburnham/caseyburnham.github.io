// Import shared data cache
import dataCache from './shared-data.js';

// Import essentials
import '/js/candy.js';
import '/js/tables/main.js';

const lazyFeatures = [
  { selector: '#climbing-map', scripts: ['/js/map.js'] },
  { selector: '#discogs-record-container', scripts: ['/js/discogs-display.js'] },
  { 
	selector: '#galleries', 
	scripts: ['/js/modal/modal.js', '/js/galleries.js'],
	init: async () => {
	  const { PhotoModal } = await import('./modal/modal.js');
	  const photoModal = new PhotoModal();
	  await photoModal.initialize();
	  window.photoModal = photoModal;
	}
  }
];

const main = () => {
  const tablesElement = document.querySelector('#tables');
  if (tablesElement) {
	dataCache.preload('/json/exif-data.json').catch(err => {
	  console.warn('Failed to preload EXIF data:', err);
	});
  }
  
  const loadFeature = async (entries, observer) => {
	for (const entry of entries) {
	  if (entry.isIntersecting) {
		const feature = lazyFeatures.find(f => entry.target.matches(f.selector));
		
		if (feature) {
		  try {
			for (const script of feature.scripts) {
			  await import(script);
			}
			
			if (feature.init) {
			  await feature.init();
			}
		  } catch (err) {
			console.error(`Failed to load scripts for ${feature.selector}`, err);
		  }
		  
		  observer.unobserve(entry.target);
		}
	  }
	}
  };
  
  // Set up intersection observer
  const observerOptions = {
	rootMargin: '200px 0px 200px 0px' 
  };
  const observer = new IntersectionObserver(loadFeature, observerOptions);
  
  for (const feature of lazyFeatures) {
	const element = document.querySelector(feature.selector);
	if (element) {
	  observer.observe(element);
	}
  }
};

main();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.photoModal?.destroy();
  window.Galleries?.destroy();
  dataCache.clear();
});