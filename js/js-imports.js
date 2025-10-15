// import '/js/video.js';
import '/js/candy.js';
import '/js/tables/main.js';
import '/js/galleries.js';
import '/js/leaflet.js';
import '/js/map.js';
import '/js/discogs-display.js';
import { PhotoModal } from './modal/modal.js';

// Function to run the modal
const main = async () => {
	// Create a single instance of the PhotoModal.
	const photoModal = new PhotoModal();
	
	// Initialize it. This creates the DOM elements and attaches listeners ONCE.
	await photoModal.initialize();

	// (Optional) Make it globally accessible for debugging or other scripts.
	window.photoModal = photoModal;
};

// Defer initialization until the DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', main);
} else {
	main();
}
