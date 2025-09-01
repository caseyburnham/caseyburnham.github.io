/**
 * GallerySwapper - Manages dynamic photo gallery switching with smooth transitions
 * Integrates with PhotoModal for seamless image viewing experience
 */
class GallerySwapper {
  // Private fields
  #galleries = {};
  #currentGallery = 'default';
  #config = {};
  #isInitialized = false;
  #elements = {};

  constructor() {
	this.#initialize();
  }

  // Public methods
  getCurrentGallery() {
	return this.#currentGallery;
  }

  getAvailableGalleries() {
	return Object.keys(this.#galleries);
  }

  switchGallery(galleryKey) {
	if (!this.#isValidGallery(galleryKey) || galleryKey === this.#currentGallery) {
	  return false;
	}

	try {
	  this.#performGallerySwitch(galleryKey);
	  return true;
	} catch (error) {
	  console.error('Failed to switch gallery:', error);
	  return false;
	}
  }

  // Private methods
  async #initialize() {
	try {
	  await this.#loadGalleries();
	  this.#createGalleryControls();
	  this.#isInitialized = true;
	} catch (error) {
	  console.error('Failed to initialize GallerySwapper:', error);
	  this.#createFallbackGallery();
	}
  }

  async #loadGalleries() {
	try {
	  const response = await fetch('/json/galleries.json');
	  
	  if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	  }

	  const data = await response.json();
	  this.#processGalleryData(data);
	  this.#loadDefaultGallery();
	} catch (error) {
	  console.warn('Could not load galleries.json:', error.message);
	  this.#createFallbackGallery();
	}
  }

  #processGalleryData(data) {
	// Extract configuration
	this.#config = data._config || {};
	delete data._config;
	
	this.#galleries = data;
	
	// Set default gallery
	const defaultKey = this.#config.defaultGallery;
	this.#currentGallery = (defaultKey && this.#galleries[defaultKey]) 
	  ? defaultKey 
	  : Object.keys(this.#galleries)[0] || 'default';
  }

  #createFallbackGallery() {
	const existingImages = this.#extractExistingImages();
	
	this.#galleries = {
	  'alpine': {
		name: 'Mountain Adventures',
		images: existingImages
	  }
	};
	
	this.#currentGallery = 'alpine';
	this.#createGalleryControls();
  }

  #extractExistingImages() {
	const images = [];
	const existingThumbs = document.querySelectorAll('.photo-thumb img');
	
	existingThumbs.forEach(img => {
	  if (img.src) {
		images.push({
		  src: img.src,
		  alt: img.alt || 'Untitled',
		  title: img.dataset.title || img.alt || 'Untitled',
		  filename: img.dataset.filename || null
		});
	  }
	});
	
	return images;
  }

  #loadDefaultGallery() {
	const gallerySection = this.#getGallerySection();
	if (!gallerySection) return;

	// Only load if no existing photo grids (preserve HTML fallback)
	const existingGrids = gallerySection.querySelectorAll('.photo-grid');
	if (existingGrids.length === 0) {
	  const gallery = this.#galleries[this.#currentGallery];
	  if (gallery?.images) {
		this.#createPhotoGrids(gallery.images, gallerySection);
		this.#initializePhotoModal();
	  }
	}
  }

  #createGalleryControls() {
	const gallerySection = this.#getGallerySection();
	if (!gallerySection || Object.keys(this.#galleries).length <= 1) return;

	try {
	  this.#removeExistingControls();
	  const buttonContainer = this.#buildControlsHTML();
	  this.#insertControls(buttonContainer, gallerySection);
	  this.#setupControlEventListeners(buttonContainer);
	} catch (error) {
	  console.error('Failed to create gallery controls:', error);
	}
  }

  #removeExistingControls() {
	const existing = document.querySelector('.gallery-controls');
	if (existing) {
	  existing.remove();
	}
  }

  #buildControlsHTML() {
	const buttonContainer = document.createElement('div');
	buttonContainer.className = 'gallery-controls';
	
	const buttonsHTML = Object.entries(this.#galleries)
	  .map(([key, gallery]) => this.#createButtonHTML(key, gallery))
	  .join('');

	buttonContainer.innerHTML = `
	  <div class="gallery-buttons" role="tablist" aria-label="Photo galleries">
		${buttonsHTML}
	  </div>
	`;

	return buttonContainer;
  }

  #createButtonHTML(key, gallery) {
	const isActive = key === this.#currentGallery;
	const safeName = this.#escapeHTML(gallery.name || key);
	
	return `
	  <button 
		type="button"
		class="gallery-btn ${isActive ? 'active' : ''}"
		data-gallery="${key}"
		role="tab"
		aria-selected="${isActive}"
		aria-controls="gallery-content"
	  >
		${safeName}
	  </button>
	`;
  }

  #insertControls(buttonContainer, gallerySection) {
	const firstGrid = gallerySection.querySelector('.photo-grid');
	const insertPoint = firstGrid || gallerySection.firstElementChild;
	
	if (insertPoint) {
	  gallerySection.insertBefore(buttonContainer, insertPoint);
	} else {
	  gallerySection.appendChild(buttonContainer);
	}
  }

  #setupControlEventListeners(container) {
	const clickHandler = (event) => {
	  const button = event.target.closest('.gallery-btn');
	  if (button?.dataset?.gallery) {
		this.switchGallery(button.dataset.gallery);
	  }
	};

	container.addEventListener('click', clickHandler);
	
	// Store reference for cleanup if needed
	this.#elements.controlsContainer = container;
	this.#elements.clickHandler = clickHandler;
  }

  #isValidGallery(galleryKey) {
	return galleryKey && this.#galleries[galleryKey];
  }

  #performGallerySwitch(galleryKey) {
	const gallery = this.#galleries[galleryKey];
	this.#currentGallery = galleryKey;

	this.#updateButtonStates(galleryKey);
	this.#transitionToNewGallery(gallery);
  }

  #updateButtonStates(activeKey) {
	const buttons = document.querySelectorAll('.gallery-btn');
	buttons.forEach(btn => {
	  const isActive = btn.dataset.gallery === activeKey;
	  btn.classList.toggle('active', isActive);
	  btn.setAttribute('aria-selected', isActive.toString());
	});
  }

  #transitionToNewGallery(gallery) {
	const gallerySection = this.#getGallerySection();
	if (!gallerySection) return;

	const existingGrids = gallerySection.querySelectorAll('.photo-grid');
	
	// Fade out existing grids
	this.#fadeOutGrids(existingGrids);
	
	// Replace content after fade out
	setTimeout(() => {
	  this.#replaceGalleryContent(existingGrids, gallery, gallerySection);
	}, 300); // Match CSS transition duration
  }

  #fadeOutGrids(grids) {
	grids.forEach(grid => {
	  grid.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
	  grid.style.opacity = '0';
	  grid.style.transform = 'translateY(20px)';
	});
  }

  #replaceGalleryContent(oldGrids, gallery, container) {
	try {
	  // Remove old grids
	  oldGrids.forEach(grid => grid.remove());
	  
	  // Create and insert new grids
	  if (gallery.images?.length) {
		this.#createPhotoGrids(gallery.images, container);
		this.#fadeInNewGrids(container);
		this.#reinitializePhotoModal();
	  }
	} catch (error) {
	  console.error('Failed to replace gallery content:', error);
	}
  }

  #fadeInNewGrids(container) {
	const newGrids = container.querySelectorAll('.photo-grid');
	newGrids.forEach((grid, index) => {
	  grid.style.opacity = '0';
	  grid.style.transform = 'translateY(20px)';
	  grid.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
	  
	  // Stagger the fade-in for visual appeal
	  setTimeout(() => {
		grid.style.opacity = '1';
		grid.style.transform = 'translateY(0)';
	  }, index * 100);
	});
  }

  #reinitializePhotoModal() {
	try {
	  if (window.photoModal?.refreshImageTracking) {
		window.photoModal.refreshImageTracking();
	  }
	} catch (error) {
	  console.error('Failed to reinitialize photo modal:', error);
	}
  }

  #createPhotoGrids(images, container) {
	if (!Array.isArray(images) || !container) return;

	const groupedImages = this.#groupImagesByLayout(images);
	
	// Create grids in order: landscape, panos (individual rows), portraits
	this.#createImageGrid(groupedImages.landscape, 'landscape-row', container);
	groupedImages.pano.forEach(image => {
	  this.#createImageGrid([image], 'pano-row', container);
	});
	this.#createImageGrid(groupedImages.portrait, 'portrait-row', container);
  }

  #groupImagesByLayout(images) {
	return images.reduce((groups, image) => {
	  const layout = image.layout || 'landscape';
	  groups[layout] = groups[layout] || [];
	  groups[layout].push(image);
	  return groups;
	}, { landscape: [], portrait: [], pano: [] });
  }

  #createImageGrid(images, rowClass, container) {
	if (!images.length) return;

	const row = document.createElement('div');
	row.className = `photo-grid ${rowClass}`;
	row.setAttribute('role', 'group');
	row.setAttribute('aria-label', `${rowClass.replace('-row', '')} photography gallery`);

	images.forEach(image => {
	  const thumb = this.#createThumbnailElement(image);
	  row.appendChild(thumb);
	});

	container.appendChild(row);
  }

  #createThumbnailElement(image) {
	if (!image?.src) {
	  throw new Error('Image must have a src property');
	}

	const thumb = document.createElement('div');
	thumb.className = 'photo-thumb';
	
	const img = document.createElement('img');
	img.src = image.src;
	img.alt = image.alt || 'Untitled';
	img.setAttribute('data-title', image.title || image.alt || 'Untitled');
	
	// Add optional attributes
	if (image.filename) {
	  img.setAttribute('data-filename', image.filename);
	}
	
	thumb.appendChild(img);
	return thumb;
  }

  #getGallerySection() {
	return document.querySelector('[aria-labelledby="gallery-heading"]');
  }

  #initializePhotoModal() {
	try {
	  if (window.photoModal?.setupAspectRatios) {
		window.photoModal.setupAspectRatios();
	  }
	} catch (error) {
	  console.warn('Could not initialize photo modal:', error);
	}
  }

  #escapeHTML(text) {
	if (typeof text !== 'string') return '';
	
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
  }

  // Static cleanup method
  static cleanup() {
	const controls = document.querySelector('.gallery-controls');
	if (controls) {
	  controls.remove();
	}
  }
}

// Auto-initialization with error handling
const initializeGallerySwapper = () => {
  try {
	window.gallerySwapper = new GallerySwapper();
  } catch (error) {
	console.error('GallerySwapper initialization failed:', error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGallerySwapper);
} else {
  initializeGallerySwapper();
}