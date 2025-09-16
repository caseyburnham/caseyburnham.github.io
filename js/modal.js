/**
 * @file PhotoModal.js
 * @description A modern, robust photo modal with EXIF data support.
 * Refactored for efficiency, clarity, and modularity.
 */
import {
	createModalHTML
} from './modal/modal-elements.js';
import {
	setupEventListeners,
	cleanupEventListeners
} from './modal/modal-events.js';


class PhotoModal {
	#state = {
		isInitialized: false,
		isOpen: false,
		currentIndex: -1,
		exifData: {},
		modalOpenDebounceTimeout: null,
		originalTriggerElement: null,
		elements: {},
		boundHandlers: {},
	};

	static #instance;

	/**
	 * Gets the best available image source from a thumbnail element's data attributes.
	 * @param {HTMLElement} thumbElement - The .photo-thumb container element.
	 * @returns {string} The URL of the best image source.
	 * @private
	 */
	#getBestImageSource(thumbElement) {
		const img = thumbElement ? thumbElement.querySelector('img') : null;
		if (!img) return '';

		try {
			const sourcesAttr = img.getAttribute('data-sources');
			if (sourcesAttr) {
				const sources = JSON.parse(sourcesAttr);
				// Prioritize formats: AVIF > any other source.
				return sources.avif || Object.values(sources)[0] || img.src;
			}
		} catch (e) {
			console.error('Failed to parse data-sources attribute:', e);
		}

		// Fallback to the image's own src if data-sources is missing or invalid.
		return img.src;
	}

	/**
	 * Private constructor to enforce the singleton pattern.
	 * @private
	 */
	constructor() {
		if (PhotoModal.#instance) {
			console.error("PhotoModal is a singleton class. Use PhotoModal.getInstance() instead.");
			return PhotoModal.#instance;
		}
		PhotoModal.#instance = this;
	}

	/**
	 * Gets the singleton instance of the PhotoModal, initializing it if necessary.
	 * @returns {Promise<PhotoModal>} The singleton instance.
	 */
	static async getInstance() {
		if (!PhotoModal.#instance) {
			PhotoModal.#instance = new PhotoModal();
			await PhotoModal.#instance.#initialize();
		} else if (!PhotoModal.#instance.#state.isInitialized) {
			await PhotoModal.#instance.#initialize();
		}
		return PhotoModal.#instance;
	}

	/**
	 * Initializes the modal by creating elements and setting up listeners.
	 * @private
	 */
	async #initialize() {
		if (this.#state.isInitialized) {
			console.warn('PhotoModal is already initialized.');
			return;
		}
		try {
			this.#createModal();
			this.#state.boundHandlers = setupEventListeners(this.#state.elements, this);
			await this.#loadExifData();
			this.#state.isInitialized = true;
			console.log('PhotoModal initialized successfully.');
		} catch (error) {
			console.error('Failed to initialize PhotoModal:', error);
			this.#state.isInitialized = false;
			throw new Error('PhotoModal initialization failed.');
		}
	}

	/**
	 * Creates the modal HTML and caches the DOM elements.
	 * @private
	 */
	#createModal() {
		const modal = document.createElement('div');
		modal.className = 'modal';
		modal.innerHTML = createModalHTML();
		document.body.appendChild(modal);

		this.#state.elements = {
			modal,
			modalContent: modal.querySelector('.modal-content'),
			modalImg: modal.querySelector('img'),
			caption: modal.querySelector('.modal-caption'),
			copyright: modal.querySelector('.modal-copyright'), 
			closeBtn: modal.querySelector('.modal-close'),
			modalCard: modal.querySelector('.modal-card'),
		};
		if (!Object.values(this.#state.elements).every(el => el)) {
			throw new Error('Failed to create one or more essential modal elements.');
		}
	}

	/**
	 * Cleans up the modal instance, removing it from the DOM and unbinding events.
	 */
	cleanup() {
		if (this.#state.elements.modal) {
			this.#state.elements.modal.remove();
		}
		cleanupEventListeners(this.#state.boundHandlers);
		this.#state.boundHandlers = {};
		this.#state.elements = {};
		this.#state.isInitialized = false;
		this.#state.isOpen = false;
		clearTimeout(this.#state.modalOpenDebounceTimeout);
		this.#state.modalOpenDebounceTimeout = null;
		PhotoModal.#instance = null;
		console.log('PhotoModal instance cleaned up.');
	}

	/**
	 * Public method to refresh image tracking for dynamic galleries.
	 */
	refreshImageTracking() {
		if (!this.#state.isInitialized) return;
		this.#state.currentIndex = -1;
	}

	/**
	 * Gets the current open state of the modal.
	 * @returns {boolean}
	 */
	get isOpen() {
		return this.#state.isOpen;
	}

	// ----- Modal Open/Close Logic -----

	/**
	 * Opens the modal with the specified image data.
	 * @param {string} src - The image source URL.
	 * @param {string} alt - The alt text for the image.
	 * @param {string} title - The title for the image caption.
	 * @param {HTMLElement} sourceElement - The element that contains the image source.
	 * @param {HTMLElement} originalTriggerElement - The element that triggered the modal.
	 */
	openModal(src, alt, title, sourceElement = null, originalTriggerElement = null) {
		let imageToLoad = src; // Default to the src passed from the trigger element.

		// If the trigger is a gallery element, try to find a better source (e.g., AVIF/WebP).
		// This makes the function backwards-compatible with simple triggers like buttons.
		if (sourceElement) {
			const bestGallerySrc = this.#getBestImageSource(sourceElement);
			if (bestGallerySrc) {
				imageToLoad = bestGallerySrc;
			}
		}

		// Now, proceed with the determined image URL.
		if (!imageToLoad || this.#state.elements.modal.classList.contains('opening')) {
			return;
		}

		this.#state.elements.modal.classList.add('opening');
		this.#state.elements.modal.setAttribute('aria-hidden', 'false');
		this.#state.originalTriggerElement = originalTriggerElement || document.activeElement;

		this.#loadImage(imageToLoad).then(loadedImg => {
			this.#updateModalContent(imageToLoad, alt, title, sourceElement, loadedImg);
		}).catch(error => {
			console.warn('Image failed to load, opening modal without it:', error);
			this.#updateModalContent(imageToLoad, alt, title, sourceElement, null);
		});
	}
	/**
	 * Preloads an image and returns a Promise.
	 * @param {string} src - The image source URL.
	 * @returns {Promise<HTMLImageElement>} The loaded image element.
	 * @private
	 */
	#loadImage(src) {
		return new Promise((resolve, reject) => {
			const tempImg = new Image();
			tempImg.onload = () => resolve(tempImg);
			tempImg.onerror = () => reject(new Error(`Failed to load image: ${src}`));
			tempImg.src = src;
		});
	}

	/**
	 * Updates the modal with new content and shows it.
	 * @private
	 */
	#updateModalContent(src, alt, title, sourceElement, loadedImg) {
		const {
			modalImg
		} = this.#state.elements;

		modalImg.src = src;
		modalImg.alt = alt || 'Untitled';
		this.#updateCurrentIndex(src);
		this.#updateCaption(title, src, sourceElement);
		this.#showModal();

		clearTimeout(this.#state.modalOpenDebounceTimeout);
		this.#state.modalOpenDebounceTimeout = setTimeout(() => {
			this.#state.elements.modal.classList.remove('opening');
			this.#state.modalOpenDebounceTimeout = null;
			this.#trapFocus();
		}, 100);
	}

	/**
	 * Closes the modal and returns focus to the trigger element.
	 * @public
	 */
	closeModal() {
		if (!this.#state.isOpen) return;

		this.#state.elements.modal.style.opacity = '0';
		this.#state.elements.modal.style.pointerEvents = 'none';
		this.#state.elements.modal.setAttribute('aria-hidden', 'true');
		this.#state.elements.modal.classList.remove('opening');
		this.#state.isOpen = false;

		clearTimeout(this.#state.modalOpenDebounceTimeout);
		this.#state.modalOpenDebounceTimeout = null;

		// Delayed display: none for transition
		setTimeout(() => {
			if (this.#state.elements.modal.style.opacity === '0') {
				this.#state.elements.modal.style.display = 'none';
			}
		}, 350);
	}

	/**
	 * Shows the modal by changing its CSS properties.
	 * @private
	 */
	#showModal() {
		const {
			modal
		} = this.#state.elements;
		modal.style.display = 'flex';
		requestAnimationFrame(() => {
			modal.style.opacity = '1';
			modal.style.pointerEvents = 'auto';
			this.#state.isOpen = true;
		});
	}

	// ----- Navigation and Data Management -----

	/**
	 * Navigates to the next or previous image in the gallery.
	 * @param {number} direction - 1 for next, -1 for previous.
	 */

	navigateImage(direction) {
		const allImages = this.#getAllGalleryImages();

		if (!allImages.length || this.#state.currentIndex < 0) {
			console.error(`Navigation aborted. Image count: ${allImages.length}, Current Index: ${this.#state.currentIndex}`);
			return;
		}

		const newIndex = (this.#state.currentIndex + direction + allImages.length) % allImages.length;

		const targetImageElement = allImages[newIndex];
		if (!targetImageElement) {
			console.error(`Navigation failed: Could not find target element at index ${newIndex}.`);
			return;
		}

		const targetSrc = this.#getBestImageSource(targetImageElement);
		if (!targetSrc) {
			console.error(`Navigation failed: Could not get best image source for element at index ${newIndex}.`, targetImageElement);
			return;
		}

		const imgElement = targetImageElement.querySelector('img');
		const alt = (imgElement && imgElement.alt) || '';
		const title = (imgElement && imgElement.dataset && imgElement.dataset.title) || '';

		this.openModal(targetSrc, alt, title, targetImageElement, null);
	}

	/**
	 * Loads EXIF data from a JSON file.
	 * @private
	 */
	async #loadExifData() {
		try {
			const response = await fetch('/json/exif-data.json');
			if (response.ok) {
				this.#state.exifData = await response.json();
			} else {
				console.warn('Failed to load EXIF data:', response.statusText);
			}
		} catch (error) {
			console.warn('Could not load EXIF data:', error.message);
			this.#state.exifData = {};
		}
	}

	/**
	 * Finds EXIF data for a given image source.
	 * @param {string} imageSrc - The image source URL.
	 * @returns {object} The EXIF data object.
	 * @private
	 */
	#findExifData(imageSrc) {
		if (!Object.keys(this.#state.exifData).length) {
			return {};
		}
		try {
			const url = new URL(imageSrc, window.location.origin);
			const normalizedSrcPath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
			const srcPathLower = normalizedSrcPath.toLowerCase();

			// --- MORE ROBUST LOGIC ---

			// Extract the base name and extension from the source image.
			const srcFilename = normalizedSrcPath.split('/').pop().toLowerCase();
			const srcParts = srcFilename.split('.');
			const srcBaseFilename = srcParts[0];
			const srcExtension = srcParts.length > 1 ? srcParts.pop() : '';

			// 1. Gather all potential matches based on the base filename.
			const candidates = [];
			for (const [key, data] of Object.entries(this.#state.exifData)) {
				const keyBase = key.split('/').pop().toLowerCase().split('.')[0];
				if (keyBase === srcBaseFilename) {
					candidates.push({ key, data });
				}
			}

			// If no candidates, exit.
			if (candidates.length === 0) {
				return {};
			}

			// If only one candidate, it must be the right one.
			if (candidates.length === 1) {
				return candidates[0].data;
			}

			// 2. We have multiple candidates (e.g., avif, heic, webp). Now, we find the best one.
			// Priority A: An exact, case-insensitive path match.
			const exactMatch = candidates.find(c => c.key.toLowerCase() === srcPathLower);
			if (exactMatch) {
				return exactMatch.data;
			}

			// Priority B: A match based on the file extension. This is the key fix.
			const extensionMatch = candidates.find(c => {
				const keyExtension = c.key.split('.').pop().toLowerCase();
				return keyExtension === srcExtension;
			});
			if (extensionMatch) {
				return extensionMatch.data;
			}

			// 3. As a last resort, return the first candidate found.
			console.warn(`Multiple EXIF candidates found for "${srcBaseFilename}" with no definitive match. Returning the first one.`);
			return candidates[0].data;

		} catch (error) {
			console.warn('Error finding EXIF data:', error);
		}

		return {};
	}

	// ----- UI/DOM Manipulation -----
	
	/**
	 * Updates the modal caption with a title and EXIF data.
	 * @private
	 */
	 #updateCaption(title, imageSrc, sourceElement) {
	   const { caption, modal, copyright } = this.#state.elements;
	   const exifData = this.#findExifData(imageSrc);
	   
	   console.log('EXIF data for this image:', exifData);
	 
	   // --- Update Caption ---
	   caption.innerHTML = this.#buildCaptionHTML(title, exifData);
	 
	   const titleElement = caption.querySelector('.caption-header .title');
	   if (titleElement) {
		 const id = `modal-title-${Date.now()}`;
		 titleElement.id = id;
		 modal.setAttribute('aria-labelledby', id);
	   } else {
		 modal.removeAttribute('aria-labelledby');
	   }
	 
	   // --- Update Copyright ---
	   if (copyright && exifData?.copyright) {
		 copyright.textContent = exifData.copyright; 
		 copyright.style.display = 'block';
	   } else if (copyright) {
		 copyright.textContent = ''; 
		 copyright.style.display = 'none';
	   }
	 }

	/**
	 * Builds the HTML for the caption using EXIF data.
	 * @private
	 */
	#buildCaptionHTML(title, photo) {
		const escapeHTML = (text) => {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		};

		const dateString = (photo && photo.date) ? `${photo.date.year}-${String(photo.date.month).padStart(2, '0')}-${String(photo.date.day).padStart(2, '0')}` : '';
		const gpsLink = (photo && photo.gps) ? this.#buildGPSLink(photo.gps) : '';
		const exifRow = this.#buildExifRow(photo, escapeHTML);
		const altitudeInFeet = (photo && photo.gps && photo.gps.alt) ? `${Math.round(photo.gps.alt * 3.28084).toLocaleString()} ft` : '';

		return `
	  <div class="caption-header">
		${dateString ? `<time datetime="${dateString}">${dateString}</time>` : ''}
		<h2 class="title">${escapeHTML(title || 'Untitled')}</h2>
		${gpsLink}
		<span class="altitude">${altitudeInFeet}</span>
	  </div>
	  <hr>
	  <span class="exif-row">${exifRow}</span>
	`;
	}

	/**
	 * Builds the GPS link HTML.
	 * @private
	 */
	#buildGPSLink(gps) {
		if (!gps || !gps.lat || !gps.lon) return '';
		const lat = parseFloat(gps.lat).toFixed(5);
		const lon = parseFloat(gps.lon).toFixed(5);
		const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=15`;
		const latDMS = gps.latDMS || lat;
		const lonDMS = gps.lonDMS || lon;
		return `<span class="gps"><a href="${url}" target="_blank" rel="noopener noreferrer">${latDMS}<wbr>, ${lonDMS}<wbr></a></span>`;
	}

	/**
	 * Builds the EXIF data row HTML.
	 * @private
	 */
	#buildExifRow(photo, escapeHTML) {
		const parts = [
			photo.cameraModel ? `<span>${photo.cameraModel}</span>` : '',
			photo.iso ? `<span>ISO ${photo.iso}</span>` : '',
			photo.lens ? `<span>${escapeHTML(photo.lens)}</span>` : '',
			photo.exposureCompensation ? `<span>${escapeHTML(photo.exposureCompensation)} ev</span>` : '',
			photo.aperture ? `<span><i>&#402;</i>${photo.aperture}</span>` : '',
			photo.shutter ? `<span>${photo.shutter}s</span>` : '',
			photo.format ? `<span class="format">${escapeHTML(photo.format)}</span>` : ''
		].filter(Boolean);
		return parts.join(' | ');
	}

	// ----- Utility Methods -----

	/**
	 * Traps focus within the modal for accessibility.
	 * @private
	 */
	#trapFocus() {
		const {
			modal,
			closeBtn,
			modalImg
		} = this.#state.elements;
		if (!modal) return;
		const focusableElements = [closeBtn, modalImg].filter(el => el);
		const firstFocusableEl = focusableElements[0];
		const lastFocusableEl = focusableElements[focusableElements.length - 1];

		if (!firstFocusableEl) return;
		const keydownHandler = (e) => {
			const isTabPressed = e.key === 'Tab';
			if (!isTabPressed) return;
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
		};
		modal.addEventListener('keydown', keydownHandler);
		this.#state.boundHandlers.modalTrapFocus = keydownHandler;
	}

	/**
	 * Updates the current image index by comparing normalized pathnames.
	 * @private
	 */
	#updateCurrentIndex(src) {
		const allImages = this.#getAllGalleryImages();

		const currentImagePath = new URL(src, window.location.origin).pathname;

		this.#state.currentIndex = allImages.findIndex((galleryImg, index) => {
			const bestSourceForThumb = this.#getBestImageSource(galleryImg);

			if (!bestSourceForThumb) {
				return false;
			}

			const candidatePath = new URL(bestSourceForThumb, window.location.origin).pathname;

			const isMatch = currentImagePath === candidatePath;

			return isMatch;
		});

	}

	/**
	 * Gets all gallery images.
	 * @private
	 */
	#getAllGalleryImages() {
		return Array.from(document.querySelectorAll('.photo-thumb'));
	}
}

// Global initialization function
const initializePhotoModal = async () => {
	try {
		window.photoModal = await PhotoModal.getInstance();
	} catch (error) {
		console.error('PhotoModal initialization failed:', error);
	}
};

// Defer initialization until DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializePhotoModal);
} else {
	initializePhotoModal();
}