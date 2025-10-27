// Lazy-load everything except essentials
import '/js/candy.js';  // Tooltips and nav are always needed
import '/js/tables/main.js';  // Tables are above the fold

// ---
// 1. Define all your lazy-loadable modules
// ---
const lazyFeatures = [
  { selector: '#climbing-map', scripts: ['/js/map.js'] },
  { selector: '#discogs-record-container', scripts: ['/js/discogs-display.js'] },
  // Load modal + galleries together when galleries section appears
  { 
	selector: '#galleries', 
	scripts: ['/js/modal/modal.js', '/js/galleries.js'],
	init: async () => {
	  // Initialize modal after loading
	  const { PhotoModal } = await import('./modal/modal.js');
	  const photoModal = new PhotoModal();
	  await photoModal.initialize();
	  window.photoModal = photoModal;
	}
  }
];

// ---
// 2. Create the observer callback function
// ---
const loadFeature = async (entries, observer) => {
  for (const entry of entries) {
	if (entry.isIntersecting) {
	  const feature = lazyFeatures.find(f => entry.target.matches(f.selector));
	  
	  if (feature) {
		try {
		  // Load all required scripts for this feature
		  for (const script of feature.scripts) {
			await import(script);
		  }
		  
		  // Run custom initialization if provided
		  if (feature.init) {
			await feature.init();
		  }
		} catch (err) {
		  console.error(`Failed to load scripts for ${feature.selector}`, err);
		}
		
		// We're done, so stop observing this element
		observer.unobserve(entry.target);
	  }
	}
  }
};

// ---
// 3. The main function to set everything up
// ---
const main = () => {
  // Set up the observer
  const observerOptions = {
	// Start loading when the element is 200px away from the screen
	rootMargin: '200px 0px 200px 0px' 
  };
  const observer = new IntersectionObserver(loadFeature, observerOptions);

  // Find all the elements on the page and start observing them
  for (const feature of lazyFeatures) {
	const element = document.querySelector(feature.selector);
	if (element) {
	  observer.observe(element);
	}
  }
};

// Run the setup
main();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.photoModal?.destroy();
  window.Galleries?.destroy();
});