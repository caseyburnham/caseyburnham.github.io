/**
 * PhotoModal - A modern, robust photo modal with EXIF data support
 * Handles aspect ratios, keyboard navigation, and EXIF metadata display
 *
 * This version addresses:
 * 1. Immediate modal closing due to click event bubbling.
 * 2. Improved singleton pattern with async initialization.
 * 3. Enhanced accessibility (focus management).
 * 4. More robust event handling.
 */
class PhotoModal {
  // Private fields
  #exifData = {};
  #currentIndex = -1;
  #elements = {};
  #eventHandlers = {};
  #isInitialized = false;
  #modalOpenDebounceTimeout = null; // To prevent immediate closing

  // Static singleton instance
  static instance = null;

  // Private constructor to enforce singleton via getInstance
  constructor() {
	if (PhotoModal.instance) {
	  return PhotoModal.instance;
	}
	PhotoModal.instance = this; // Set instance early for internal methods
  }

  // Static method to get the initialized instance
  static async getInstance() {
	if (!PhotoModal.instance) {
	  const modalInstance = new PhotoModal();
	  await modalInstance.#initialize();
	  PhotoModal.instance = modalInstance;
	} else if (!PhotoModal.instance.#isInitialized) {
	  // Handle case where constructor ran but initialize failed
	  await PhotoModal.instance.#initialize();
	}
	return PhotoModal.instance;
  }

  // Public methods
  async #initialize() {
	if (this.#isInitialized) {
	  console.warn('PhotoModal already initialized.');
	  return;
	}

	try {
	  this.#cleanup(); // Cleanup any prior attempts or existing modals
	  this.#createModal();
	  this.#setupEventListeners();
	  this.#setupAspectRatios();
	  await this.#loadExifData();
	  this.#isInitialized = true;
	  console.log('PhotoModal initialized successfully.');
	} catch (error) {
	  console.error('Failed to initialize PhotoModal:', error);
	  this.#isInitialized = false; // Mark as not initialized on failure
	  // Re-throw to indicate initialization failure to caller
	  throw new Error('PhotoModal initialization failed');
	}
  }

  refreshImageTracking() {
	if (!this.#isInitialized) return;

	this.#currentIndex = -1;
	this.#setupAspectRatios();
  }

  // Public method for external gallery management
  setupAspectRatios() {
	this.#setupAspectRatios();
  }

  // Private methods
  #cleanup() {
	const existingModal = document.querySelector('.modal');
	if (existingModal) {
	  existingModal.remove();
	}

	// Clean up existing event listeners managed by this class
	Object.values(this.#eventHandlers).forEach(handler => {
	  if (handler.cleanup) handler.cleanup(); // Use a cleanup method if defined on handler
	});
	// Remove global listeners explicitly
	if (this.#elements.modal) {
	  this.#elements.modal.removeEventListener('click', this.#eventHandlers.modalClick);
	  this.#elements.modal.removeEventListener('transitionend', this.#eventHandlers.modalTransitionEnd);
	}
	if (this.#elements.closeBtn) {
	  this.#elements.closeBtn.removeEventListener('click', this.#eventHandlers.closeClick);
	}
	document.removeEventListener('keydown', this.#eventHandlers.keydown);
	document.removeEventListener('click', this.#eventHandlers.globalClickHandler); // Use one global handler
	this.#eventHandlers = {};
	this.#elements = {}; // Clear cached elements
	this.#isInitialized = false;
	clearTimeout(this.#modalOpenDebounceTimeout);
  }

  #createModal() {
	const modal = document.createElement('div');
	modal.className = 'modal';
	// Initially hidden for smooth transition
	modal.style.cssText = 'display: none; opacity: 0; pointer-events: none;';
	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');
	modal.setAttribute('aria-hidden', 'true'); // Start hidden for AT

	modal.innerHTML = `
	  <div class="modal-content">
		<button class="modal-close" aria-label="Close modal">&times;</button>
		<div class="modal-card">
		  <img src="" alt="" role="img" aria-live="polite">
		  <div class="modal-caption" role="complementary"></div>
		</div>

	  </div>
	`;

	document.body.appendChild(modal);

	// Cache DOM elements
	this.#elements = {
	  modal,
	  modalContent: modal.querySelector('.modal-content'), // Added for better focus trapping
	  modalImg: modal.querySelector('img'),
	  caption: modal.querySelector('.modal-caption'),
	  closeBtn: modal.querySelector('.modal-close'),
	  modalCard: modal.querySelector('.modal-card')
	};

	if (!this.#elements.modalImg || !this.#elements.caption || !this.#elements.closeBtn) {
	  throw new Error('Failed to create essential modal elements');
	}
  }

  #setupEventListeners() {
	const { modal, closeBtn} = this.#elements;

	// Use a single global delegated click handler to prevent conflicts
	this.#eventHandlers.globalClickHandler = this.#createGlobalClickHandler();
	document.addEventListener('click', this.#eventHandlers.globalClickHandler);

	this.#eventHandlers.keydown = this.#createKeydownHandler();
	document.addEventListener('keydown', this.#eventHandlers.keydown);

	this.#eventHandlers.closeClick = () => this.#closeModal();
	closeBtn.addEventListener('click', this.#eventHandlers.closeClick);

	this.#eventHandlers.modalClick = this.#createModalBackgroundClickHandler();
	modal.addEventListener('click', this.#eventHandlers.modalClick); // Listen on modal for background clicks

	this.#eventHandlers.modalTransitionEnd = this.#handleModalTransitionEnd.bind(this);
	modal.addEventListener('transitionend', this.#eventHandlers.modalTransitionEnd);

  }

  /**
   * Centralized global click handler to dispatch to specific element handlers.
   * This helps manage event bubbling and `stopPropagation`.
   */
  #createGlobalClickHandler() {
	return (event) => {
	  const photoThumb = event.target.closest('.photo-thumb');
	  const cameraLink = event.target.closest('.camera-link');

	  if (photoThumb) {
		event.preventDefault();
		event.stopPropagation(); // Stop propagation immediately after handling
		this.#handleThumbnailClick(photoThumb);
	  } else if (cameraLink) {
		event.preventDefault();
		event.stopPropagation(); // Stop propagation immediately after handling
		this.#handleCameraLinkClick(cameraLink);
	  }
	};
  }

  #createKeydownHandler() {
	return (event) => {
	  if (!this.#isModalOpen()) return;

	  const { key } = event;
	  const actions = {
		'Escape': () => this.#closeModal(),
		'ArrowRight': () => this.#navigateImage(1),
		'ArrowLeft': () => this.#navigateImage(-1)
	  };

	  if (actions[key]) {
		event.preventDefault();
		actions[key]();
	  }
	};
  }

  /**
   * Handles clicks on the modal background to close it.
   * Crucially, it has a debounce to prevent immediate closing after opening.
   */
  #createModalBackgroundClickHandler() {
	return (event) => {
	  // Only close if clicking directly on the modal background
	  // AND the debounce has passed (modal has been open for a short time)
	  if (event.target === this.#elements.modal && this.#modalOpenDebounceTimeout === null) {
		this.#closeModal();
	  }
	  // If modalOpenDebounceTimeout is not null, it means the modal just opened
	  // and this click is likely the opening click bubbling up. Ignore it.
	};
  }

  #handleThumbnailClick(thumbElement) {
	try {
	  const img = thumbElement.querySelector('img');
	  if (img?.src) {
		this.#openModal(img, thumbElement, thumbElement); // Pass original click target for focus restoration
	  }
	} catch (error) {
	  console.error('Failed to handle thumbnail click:', error);
	}
  }

  #handleCameraLinkClick(cameraElement) {
	try {
	  const imageUrl = cameraElement.dataset.image;
	  if (!imageUrl) return;

	  const tempImg = this.#createImageElement(imageUrl, cameraElement);
	  // We don't need a setTimeout here anymore because globalClickHandler handles stopPropagation
	  this.#loadImageAndOpenModal(tempImg, cameraElement, cameraElement); // Pass original click target
	} catch (error) {
	  console.error('Failed to handle camera link click:', error);
	}
  }

  #createImageElement(src, sourceElement) {
	const img = new Image();
	img.src = src;
	img.alt = sourceElement.title ||
			  sourceElement.getAttribute('aria-label') ||
			  'Camera Image';
	return img;
  }

  #loadImageAndOpenModal(img, sourceElement, originalTriggerElement) {
	const openModal = () => this.#openModal(img, sourceElement, originalTriggerElement);

	// Ensure load/error handlers are attached once
	img.addEventListener('load', openModal, { once: true });
	img.addEventListener('error', openModal, { once: true }); // Open even if error, but show alt text
	// If image is already complete (cached), trigger immediately
	if (img.complete) {
		openModal();
	}
  }

  #setupAspectRatios() {
	const images = document.querySelectorAll('.photo-thumb img');
	images.forEach(img => {
	  if (img.complete && img.naturalWidth) {
		this.#classifyAspectRatio(img);
	  } else {
		img.addEventListener('load', () => this.#classifyAspectRatio(img), { once: true });
	  }
	});
  }

  #classifyAspectRatio(img) {
	if (!img.naturalWidth || !img.naturalHeight) return;

	const ratio = img.naturalWidth / img.naturalHeight;
	const parent = img.parentElement;
	if (!parent) return;

	// Remove existing aspect ratio classes
	const aspectClasses = ['pano', 'portrait', 'square', 'landscape'];
	parent.classList.remove(...aspectClasses);

	// Add appropriate class based on aspect ratio
	const classification = this.#getAspectRatioClass(ratio);
	parent.classList.add(classification);
  }

  #getAspectRatioClass(ratio) {
	if (ratio > 2) return 'pano';
	if (ratio < 0.8) return 'portrait';
	if (Math.abs(ratio - 1) < 0.1) return 'square';
	return 'landscape';
  }

  #classifyModalAspectRatio(img) {
	if (!img.naturalWidth || !img.naturalHeight) return;

	const ratio = img.naturalWidth / img.naturalHeight;
	const { modal, modalCard } = this.#elements;

	// Clean existing classes
	const aspectClasses = ['pano', 'portrait', 'square', 'landscape'];
	modal.classList.remove(...aspectClasses);
	modalCard.classList.remove('modal-card--pano');

	// Apply new classification
	const classification = this.#getAspectRatioClass(ratio);
	modal.classList.add(classification);

	if (classification === 'pano') {
	  modalCard.classList.add('modal-card--pano');
	}
  }

  async #loadExifData() {
	try {
	  const response = await fetch('/json/exif-data.json');
	  if (response.ok) {
		this.#exifData = await response.json();
	  } else {
		console.warn('Failed to load EXIF data:', response.statusText);
	  }
	} catch (error) {
	  console.warn('Could not load EXIF data:', error.message);
	  this.#exifData = {};
	}
  }

  #openModal(img, sourceElement = null, originalTriggerElement = null) {
	if (!img?.src) return;

	const { modal } = this.#elements;
	if (this.#isModalOpen() || modal.classList.contains('opening')) {
	  // console.log('Modal already open or opening, preventing duplicate action.');
	  return;
	}

	try {
	  modal.classList.add('opening'); // Indicate modal is in opening state
	  modal.setAttribute('aria-hidden', 'false');

	  // Store the element that triggered the modal for focus restoration
	  this.#elements.originalTriggerElement = originalTriggerElement || document.activeElement;

	  this.#updateCurrentIndex(img);
	  this.#updateModalImage(img);
	  this.#updateModalAspectRatio(img, sourceElement);
	  this.#updateCaption(img, sourceElement);
	  this.#showModal();

	  // Debounce to prevent the opening click from immediately closing the modal
	  clearTimeout(this.#modalOpenDebounceTimeout);
	  this.#modalOpenDebounceTimeout = setTimeout(() => {
		modal.classList.remove('opening');
		this.#modalOpenDebounceTimeout = null;
		this.#trapFocus(); // Trap focus once fully opened
	  }, 100); // Small delay to allow the opening click event to fully propagate and resolve
	} catch (error) {
	  console.error('Failed to open modal:', error);
	  modal.classList.remove('opening');
	  modal.setAttribute('aria-hidden', 'true');
	  clearTimeout(this.#modalOpenDebounceTimeout);
	  this.#modalOpenDebounceTimeout = null;
	}
  }

  #updateCurrentIndex(img) {
	const allImages = this.#getAllGalleryImages();
	// Compare img.src to ensure correct index, especially if img is a temp img
	this.#currentIndex = allImages.findIndex(galleryImg => galleryImg.src === img.src);
  }

  #updateModalImage(img) {
	const { modalImg } = this.#elements;
	modalImg.src = img.src;
	modalImg.alt = img.alt || 'Untitled';
	// Clear existing aspect ratio classes from image itself if any
	modalImg.classList.remove('pano', 'portrait', 'square', 'landscape');
  }

  #updateModalAspectRatio(img, sourceElement) {
	if (sourceElement?.classList?.contains('photo-thumb')) {
	  this.#copyAspectRatioFromThumbnail(sourceElement);
	} else {
	  this.#setAspectRatioFromImage(img);
	}
  }

  #copyAspectRatioFromThumbnail(thumbElement) {
	const { modal, modalCard } = this.#elements;
	const aspectClasses = ['pano', 'portrait', 'square', 'landscape'];

	aspectClasses.forEach(className => {
	  const hasClass = thumbElement.classList.contains(className);
	  modal.classList.toggle(className, hasClass);

	  if (className === 'pano') {
		modalCard.classList.toggle('modal-card--pano', hasClass);
	  }
	});
  }

  #setAspectRatioFromImage(img) {
	if (img.complete && img.naturalWidth) {
	  this.#classifyModalAspectRatio(img);
	} else {
	  // Create a temporary image to load and get natural dimensions
	  const tempImg = new Image();
	  tempImg.src = img.src;
	  tempImg.addEventListener('load', () => {
		this.#classifyModalAspectRatio(tempImg);
	  }, { once: true });
	  tempImg.addEventListener('error', () => {
		// Fallback or just ignore if image fails to load for aspect ratio
		console.warn('Failed to load image for aspect ratio classification:', img.src);
	  }, { once: true });
	}
  }

  #updateCaption(img, sourceElement) {
	try {
	  const title = this.#extractTitle(img, sourceElement);
	  const photo = this.#findExifData(img.src);

	  this.#elements.caption.innerHTML = this.#buildCaptionHTML(title, photo);
	  // Set aria-labelledby for better accessibility if title is present
	  if (title) {
		// Assign an ID to the title for aria-labelledby
		const titleElement = this.#elements.caption.querySelector('.caption-header .title');
		if (titleElement) {
		  const id = `modal-title-${Date.now()}`;
		  titleElement.id = id;
		  this.#elements.modal.setAttribute('aria-labelledby', id);
		}
	  }
	} catch (error) {
	  console.error('Failed to update caption:', error);
	  this.#elements.caption.innerHTML = '<div class="caption-header"><h2>Image</h2></div>';
	  this.#elements.modal.removeAttribute('aria-labelledby'); // Clear if error
	}
  }

  #extractTitle(img, sourceElement) {
	const sources = [
	  sourceElement?.dataset?.title,
	  img.dataset?.title,
	  sourceElement?.title,
	  sourceElement?.getAttribute?.('aria-label'),
	  img.alt
	];

	return sources.find(title => title && title.trim()) || 'Untitled';
  }

  #findExifData(imageSrc) {
	if (!this.#exifData || !Object.keys(this.#exifData).length) {
	  return {};
	}

	try {
	  // Normalize imageSrc to relative path for consistent key comparison
	  const url = new URL(imageSrc, window.location.origin);
	  let keyToMatch = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
	  keyToMatch = keyToMatch.replace(/^images\//, ''); // Remove common 'images/' prefix

	  if (this.#exifData[keyToMatch]) {
		return this.#exifData[keyToMatch];
	  }

	  // Fallback to fuzzy matching if exact key not found
	  return this.#fuzzyMatchExifData(url.pathname.split('/').pop());
	} catch (error) {
	  console.warn('Error finding EXIF data:', error);
	  return {};
	}
  }

  #fuzzyMatchExifData(filename) {
	const lowerFilename = filename.toLowerCase();

	for (const [key, data] of Object.entries(this.#exifData)) {
	  const lowerKey = key.toLowerCase();
	  // Look for filename within key or key within filename
	  if (lowerKey.includes(lowerFilename) || lowerFilename.includes(lowerKey)) {
		return data;
	  }
	}

	return {};
  }

  #buildCaptionHTML(title, photo) {
	const dateString = this.#formatExifDate(photo.date);
	const gpsLink = photo.gps ? this.#buildGPSLink(photo.gps) : '';
	const exifRow = this.#buildExifRow(photo);

	return `
	  <div class="caption-header">
		${dateString ? `<time datetime="${dateString}">${dateString}</time>` : ''}
		<h2 class="title">${this.#escapeHTML(title)}</h2>
		${gpsLink}
	  </div>
	  <hr>
	  <span class="exif-row">${exifRow}</span>
	`;
  }

  #buildGPSLink(gps) {
	if (!gps?.lat || !gps?.lon) return '';

	const lat = parseFloat(gps.lat).toFixed(5);
	const lon = parseFloat(gps.lon).toFixed(5);
	const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=15`;
	
	const latDMS = gps.latDMS || lat;
	const lonDMS = gps.lonDMS || lon;

	return `
	  <span class="gps">
		<a href="${url}" target="_blank" rel="noopener noreferrer">
		  ${latDMS}<wbr>, ${lonDMS}<wbr>
		</a>
	  </span>
	`;
  }

  #buildExifRow(photo) {
	const parts = [
	  photo.iso ? `<span>ISO ${photo.iso}</span>` : '',
	  photo.lens ? `<span>${this.#escapeHTML(photo.lens)}</span>` : '',
	  photo.aperture ? `<span><i>&#402;</i>${photo.aperture}</span>` : '',
	  photo.shutter ? `<span>${photo.shutter}s</span>` : '',
	  photo.format ? `<span class="format">${this.#escapeHTML(photo.format)}</span>` : ''
	].filter(Boolean);

	return parts.join(' | ');
  }

  #escapeHTML(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
  }

  #showModal() {
	const { modal } = this.#elements;
	modal.style.display = 'flex'; // Make it visible for transitions

	requestAnimationFrame(() => {
	  modal.style.opacity = '1';
	  modal.style.pointerEvents = 'auto'; // Enable interactions
	});
  }

  #closeModal() {
	if (!this.#isModalOpen()) return;

	const { modal, originalTriggerElement } = this.#elements;
	modal.style.opacity = '0';
	modal.style.pointerEvents = 'none'; // Disable interactions immediately
	modal.setAttribute('aria-hidden', 'true');
	modal.classList.remove('opening'); // Ensure this is removed

	// Clear any pending debounce timeout
	clearTimeout(this.#modalOpenDebounceTimeout);
	this.#modalOpenDebounceTimeout = null;

	// The modalTransitionEnd handler will set display: none
	// Fallback in case transitionend doesn't fire (e.g., if display was already none)
	setTimeout(() => {
	  if (modal.style.opacity === '0' && modal.style.display === 'flex') {
		modal.style.display = 'none';
		if (originalTriggerElement && originalTriggerElement.focus) {
		  originalTriggerElement.focus(); // Restore focus
		}
	  }
	}, 350); // Slightly longer than typical transition duration
  }

  #handleModalTransitionEnd(event) {
	const { modal, originalTriggerElement } = this.#elements;
	// Only act on opacity transition end of the modal itself
	if (event.propertyName === 'opacity' && modal.style.opacity === '0') {
	  modal.style.display = 'none';
	  if (originalTriggerElement && originalTriggerElement.focus) {
		originalTriggerElement.focus(); // Restore focus to the element that opened the modal
	  }
	}
  }

  #navigateImage(direction) {
	const allImages = this.#getAllGalleryImages();

	if (!allImages.length || this.#currentIndex < 0) return;

	const newIndex = this.#calculateNewIndex(direction, allImages.length);
	const targetImage = allImages[newIndex];

	if (targetImage) {
	  // Remove opening class to allow navigation
	  this.#elements.modal.classList.remove('opening');
	  clearTimeout(this.#modalOpenDebounceTimeout);
	  this.#modalOpenDebounceTimeout = null;

	  this.#navigateToImage(targetImage, newIndex);
	}
  }

  #calculateNewIndex(direction, totalImages) {
	const nextIndex = this.#currentIndex + direction;

	if (nextIndex >= totalImages) return 0;
	if (nextIndex < 0) return totalImages - 1;

	return nextIndex;
  }

  #navigateToImage(img, newIndex) {
	try {
	  this.#currentIndex = newIndex;
	  const thumbElement = img.parentElement; // Assumes img is inside a .photo-thumb

	  this.#updateModalImage(img);
	  this.#updateModalAspectRatio(img, thumbElement);
	  this.#updateCaption(img, thumbElement);
	} catch (error) {
	  console.error('Failed to navigate to image:', error);
	}
  }

  #getAllGalleryImages() {
	// Only include images within .photo-thumb for gallery navigation
	return Array.from(document.querySelectorAll('.photo-thumb img'));
  }

  #isModalOpen() {
	return this.#elements.modal?.style.display === 'flex' &&
		   this.#elements.modal?.style.opacity === '1';
  }

  #formatExifDate(dateObj) {
	if (!dateObj?.year) return '';

	const pad = (n) => String(n).padStart(2, '0');
	return `${dateObj.year}-${pad(dateObj.month || 1)}-${pad(dateObj.day || 1)}`;
  }

  // Accessibility: Focus trapping
  #trapFocus() {
	const { modal, closeBtn, modalImg } = this.#elements;
	if (!modal) return;

	// Get all focusable elements inside the modal
	const focusableElements = [
	  closeBtn,
	  modalImg, // The image itself might be focusable
	  ...Array.from(modal.querySelectorAll('a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'))
	].filter(el => el && !el.disabled && el.offsetParent !== null); // Filter out hidden/disabled elements

	const firstFocusableEl = focusableElements[0];
	const lastFocusableEl = focusableElements[focusableElements.length - 1];

	if (!firstFocusableEl) return;


	modal.addEventListener('keydown', (e) => {
	  const isTabPressed = e.key === 'Tab' || e.keyCode === 9;

	  if (!isTabPressed) {
		return;
	  }

	  if (e.shiftKey) { // Shift + Tab
		if (document.activeElement === firstFocusableEl) {
		  lastFocusableEl.focus();
		  e.preventDefault();
		}
	  } else { // Tab
		if (document.activeElement === lastFocusableEl) {
		  firstFocusableEl.focus();
		  e.preventDefault();
		}
	  }
	});
  }


  // Static cleanup method for external use
  static cleanup() {
	if (PhotoModal.instance) {
	  PhotoModal.instance.#cleanup();
	  PhotoModal.instance = null;
	}
  }
}


// Auto-initialization with async/await
const initializePhotoModal = async () => {
  try {
	// Use the static getInstance method to ensure proper initialization
	window.photoModal = await PhotoModal.getInstance();
  } catch (error) {
	console.error('PhotoModal initialization failed:', error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePhotoModal);
} else {
  initializePhotoModal();
}