// The only script you import statically is the modal,
// which you want to be available right away.
import { PhotoModal } from './modal/modal.js';
import '/js/candy.js';
import '/js/tables/main.js';
import '/js/galleries.js';
// ---
// 1. Define all your lazy-loadable modules
// ---
const lazyFeatures = [
  { selector: '#climbing-map', scripts: ['/js/map.js'] },
  { selector: '#discogs-record-container', scripts: ['/js/discogs-display.js'] }
];

// ---
// 2. Create the observer callback function
// ---
// This function runs whenever an observed element gets
// close to the viewport.
// ---
const loadFeature = async (entries, observer) => {
  for (const entry of entries) {
	// Is the element intersecting (or about to)?
	if (entry.isIntersecting) {
	  // Find which feature this element belongs to
	  const feature = lazyFeatures.find(f => entry.target.matches(f.selector));
	  
	  if (feature) {
		try {
		  // Load all required scripts for this feature
		  for (const script of feature.scripts) {
			await import(script);
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
const main = async () => {
  // Initialize modal (runs immediately on every page load)
  const photoModal = new PhotoModal();
  await photoModal.initialize();
  window.photoModal = photoModal;

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

window.addEventListener('beforeunload', () => {
  window.photoModal?.destroy();
  window.Galleries?.destroy();
});