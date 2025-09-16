/**
 * Galleries - Streamlined photo gallery manager with smooth transitions
 */
class Galleries {
  static CONFIG = {
	DATA_URL: '/json/gallery-data.json',
	CONTROLS_SELECTOR: '.gallery-controls',
	GRID_SELECTOR: '.photo-grid',
	BUTTON_SELECTOR: '.gallery-btn',
	CONTAINER_SELECTOR: '[aria-labelledby="gallery-heading"]',
	TRANSITION_DURATION: 200, // in ms
  };

  constructor() {
	this.galleries = {};
	this.currentGallery = null;
	this.isInitialized = false;
	// REFACTOR: Cache the main container element.
	this.galleryContainer = document.querySelector(Galleries.CONFIG.CONTAINER_SELECTOR);

	this.init();
  }

  // Public API
  getCurrentGallery = () => this.currentGallery;
  getAvailableGalleries = () => Object.keys(this.galleries);

  switchGallery(galleryKey) {
	if (!this.galleries[galleryKey] || galleryKey === this.currentGallery) {
	  return false;
	}
	this.performGallerySwitch(galleryKey);
	return true;
  }

  // Initialization
  async init() {
	if (!this.galleryContainer) {
	  console.error('Gallery container not found.');
	  return;
	}
	try {
	  await this.loadGalleries();
	  this.createGalleryControls();
	  this.isInitialized = true;
	} catch (error) {
	  console.error('Gallery initialization failed:', error);
	  this.createFallbackGallery();
	}
  }

  async loadGalleries() {
	const response = await fetch(Galleries.CONFIG.DATA_URL);
	if (!response.ok) {
	  throw new Error(`Failed to load galleries: ${response.status}`);
	}
	const data = await response.json();
	const { _config, ...galleries } = data;

	this.galleries = galleries;

	// Set current gallery
	const defaultKey = _config?.defaultGallery;
	this.currentGallery = (defaultKey && galleries[defaultKey]) ? defaultKey : Object.keys(galleries)[0];

	this.loadDefaultGallery();
  }

  createFallbackGallery() {
	const images = Array.from(document.querySelectorAll('.photo-thumb img'))
	  .filter(img => img.src)
	  .map(img => ({
		id: img.dataset.filename || `img-${Math.random().toString(36).substr(2, 9)}`,
		sources: { avif: img.src },
		thumbnail: img.src,
		alt: img.alt || 'Untitled',
		title: img.dataset.title || img.alt || 'Untitled',
		layout: 'landscape',
	  }));

	this.galleries = { fallback: { name: 'Photo Gallery', images } };
	this.currentGallery = 'fallback';
	this.createGalleryControls();
	this.renderGallery(this.galleries.fallback);
  }

  // Gallery Controls
  createGalleryControls() {
	const galleryKeys = Object.keys(this.galleries);
	if (galleryKeys.length <= 1) return;

	const controlsFragment = document.createDocumentFragment();
	const controls = document.createElement('div');
	controls.className = 'gallery-controls';

	const buttonsContainer = document.createElement('div');
	buttonsContainer.className = 'gallery-buttons';
	buttonsContainer.role = 'tablist';
	buttonsContainer.setAttribute('aria-label', 'Photo galleries');

	galleryKeys.forEach(key => {
	  const gallery = this.galleries[key];
	  const isActive = key === this.currentGallery;
	  const button = document.createElement('button');
	  button.type = 'button';
	  button.className = `gallery-btn ${isActive ? 'active' : ''}`;
	  button.dataset.gallery = key;
	  button.role = 'tab';
	  button.setAttribute('aria-selected', isActive);
	  button.textContent = gallery.name || key; // textContent is safer than innerHTML
	  buttonsContainer.appendChild(button);
	});

	controls.appendChild(buttonsContainer);
	controlsFragment.appendChild(controls);

	// Remove existing controls and add new ones
	this.galleryContainer.querySelector(Galleries.CONFIG.CONTROLS_SELECTOR)?.remove();
	const insertPoint = this.galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR) || this.galleryContainer.firstElementChild;
	this.galleryContainer.insertBefore(controlsFragment, insertPoint);

	// Setup events
	controls.addEventListener('click', (e) => {
	  const button = e.target.closest(Galleries.CONFIG.BUTTON_SELECTOR);
	  if (button?.dataset?.gallery) {
		this.switchGallery(button.dataset.gallery);
	  }
	});
  }

  // Gallery Loading and Display
  loadDefaultGallery() {
	// Only render if no grid exists yet
	if (!this.galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR)) {
	  const gallery = this.galleries[this.currentGallery];
	  if (gallery?.images?.length) {
		this.renderGallery(gallery, false); // No transition on initial load
		this.initPhotoModal();
	  }
	}
  }
  
  renderGallery(gallery, withTransition = true) {
	if (!gallery.images?.length) {
	  this.galleryContainer.innerHTML = ''; // Clear container if no images
	  return;
	}

	const newGridsFragment = this.createPhotoGrids(gallery.images);
	
	if (!withTransition) {
	  this.galleryContainer.appendChild(newGridsFragment);
	  return;
	}
	
	// Handle transition logic within this async function.
	this.transitionToNewGallery(newGridsFragment);
  }

  createPhotoGrids(images) {
	const fragment = document.createDocumentFragment();
	if (!Array.isArray(images)) return fragment;

	const groups = images.reduce((acc, image) => {
	  const layout = ['landscape', 'portrait', 'pano'].includes(image.layout) ? image.layout : 'landscape';
	  acc[layout].push(image);
	  return acc;
	}, { landscape: [], portrait: [], pano: [] });

	const landscapeRows = this.generateRows(groups.landscape, 'landscape-row', 4);
	const portraitRows = this.generateRows(groups.portrait, 'portrait-row', 5);
	const panoRows = groups.pano.map(image => ({ images: [image], rowClass: 'pano-row' }));

	// REFACTOR: Interleave rows in a more readable way.
	const allRows = [];
	const maxLength = Math.max(landscapeRows.length, portraitRows.length, panoRows.length);
	for (let i = 0; i < maxLength; i++) {
	  if (landscapeRows[i]) allRows.push(landscapeRows[i]);
	  if (panoRows[i]) allRows.push(panoRows[i]);
	  if (portraitRows[i]) allRows.push(portraitRows[i]);
	}
	
	allRows.forEach(row => {
	  if (row.images.length > 0) {
		fragment.appendChild(this.createImageGrid(row.images, row.rowClass));
	  }
	});

	return fragment;
  }

  generateRows(images, rowClass, maxPerRow) {
	if (!images.length) return [];
	const rows = [];
	let i = 0;
	while (i < images.length) {
	  const remaining = images.length - i;
	  let numInRow = maxPerRow;

	  // Logic to prevent "stragglers" remains, as it's a useful feature.
	  if (remaining <= maxPerRow + 1 && remaining > maxPerRow) {
		numInRow = Math.ceil(remaining / 2);
	  } else if (remaining <= maxPerRow) {
		numInRow = remaining;
	  }
	  
	  const chunk = images.slice(i, i + numInRow);
	  rows.push({ images: chunk, rowClass });
	  i += chunk.length;
	}
	return rows;
  }

  createImageGrid(images, rowClass) {
	const row = document.createElement('div');
	row.className = `photo-grid ${rowClass}`;
	row.setAttribute('role', 'group');

	images.forEach(image => {
	  if (!this.isValidImage(image)) {
		console.warn('Invalid image data:', image);
		return;
	  }
	  const thumb = document.createElement('div');
	  thumb.className = 'photo-thumb';
	  const img = document.createElement('img');
	  img.src = image.thumbnail || '';
	  if (!img.src) {
		console.warn('Image is missing a thumbnail source:', image);
		return;
	  }
	  img.alt = image.alt || 'Untitled';
	  img.setAttribute('data-sources', JSON.stringify(image.sources));
	  img.setAttribute('data-title', image.title || image.alt || 'Untitled');
	  if (image.id) img.setAttribute('data-filename', image.id);
	  thumb.appendChild(img);
	  row.appendChild(thumb);
	});
	return row;
  }

  // Gallery Switching
  performGallerySwitch(galleryKey) {
	this.currentGallery = galleryKey;

	// Update button states
	this.galleryContainer.querySelectorAll(Galleries.CONFIG.BUTTON_SELECTOR).forEach(btn => {
	  const isActive = btn.dataset.gallery === galleryKey;
	  btn.classList.toggle('active', isActive);
	  btn.setAttribute('aria-selected', isActive.toString());
	});

	this.renderGallery(this.galleries[galleryKey], true);
  }
  
  async transitionToNewGallery(newContentFragment) {
	const existingGrids = [...this.galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR)];
	
	// Fade out existing grids
	const fadeOutPromises = existingGrids.map(grid => this.fade(grid, 'out'));
	await Promise.all(fadeOutPromises);

	// Remove old grids after they have faded out
	existingGrids.forEach(grid => grid.remove());
	
	// Add new grids (initially invisible)
	const newGrids = [...newContentFragment.children];
	newGrids.forEach(grid => grid.style.opacity = '0');
	this.galleryContainer.appendChild(newContentFragment);

	// Fade in new grids sequentially
	for (const [index, grid] of newGrids.entries()) {
		await this.fade(grid, 'in', index * 100);
	}

	this.refreshPhotoModal();
  }
  
  fade(element, direction, delay = 0) {
	return new Promise(resolve => {
		const isIn = direction === 'in';
		element.style.transition = `opacity ${Galleries.CONFIG.TRANSITION_DURATION}ms ease`;
		
		setTimeout(() => {
			// This listener resolves the promise once the transition is complete.
			const transitionEndHandler = () => {
				element.removeEventListener('transitionend', transitionEndHandler);
				resolve();
			};
			element.addEventListener('transitionend', transitionEndHandler);
			
			// Trigger the transition.
			element.style.opacity = isIn ? '1' : '0';
		}, delay);
	});
  }

  // Photo Modal Integration
  initPhotoModal = () => window.photoModal?.setupAspectRatios?.();
  refreshPhotoModal = () => window.photoModal?.refreshImageTracking?.();

  // Utilities
  isValidImage(image) {
	return image?.sources && typeof image.sources === 'object' && Object.keys(image.sources).length > 0;
  }
}

function initializeGalleries() {
  try {
	window.Galleries = new Galleries();
  } catch (error) {
	console.error('Galleries initialization failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGalleries);
} else {
  initializeGalleries();
}