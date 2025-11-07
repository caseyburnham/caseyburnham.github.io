/**
 * Modal
 * @file PhotoModal.js
 * @description A modern, robust photo modal with EXIF data support.
 **/
import {
	setupEventListeners,
	cleanupEventListeners
} from './modal-events.js';
import dataCache from '../utils/shared-data.js';
import { formatExifDate, formatElevation, findExifData } from '../utils/exif-utils.js';

// Constants
const SELECTORS = {
	PHOTO_THUMB: '.photo-thumb',
	CAMERA_LINK: '.camera-link',
	MODAL_TEMPLATE: '#photo-modal-template',
	IMG: 'img',
	MODAL_CARD: '.modal-card',
	MODAL_CAPTION: '.modal-caption',
	PHOTO_DATE: '.photo-date',
	TITLE: '.title',
	GPS: '.gps',
	ALTITUDE: '.altitude',
	EXIF_ROW: '.exif-row',
	COPYRIGHT: '.copyright'
};

export class PhotoModal {
	#state = {
		isInitialized: false,
		isOpen: false,
		currentIndex: -1,
		exifData: {},
		originalTriggerElement: null,
		elements: {},
		boundHandlers: {},
		currentImageLoad: null,
		galleryImagesCache: null,
		captionTemplate: null,
		focusableElements: []
	};

	// Public getter for originalTriggerElement (needed by modal-events.js)
	get originalTriggerElement() {
		return this.#state.originalTriggerElement;
	}

	async initialize() {
		if (this.#state.isInitialized) {
			console.warn('PhotoModal is already initialized.');
			return;
		}

		try {
			this.#createModal();
			this.#cacheCaptionTemplate();
			this.#state.boundHandlers = setupEventListeners(this.#state.elements, this);
			await this.#loadExifData();
			this.#state.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize PhotoModal:', error);
			this.#state.isInitialized = false;
			throw error;
		}
	}

	destroy() {
		if (!this.#state.isInitialized) return;

		if (this.#state.currentImageLoad) {
			this.#state.currentImageLoad.cancel();
			this.#state.currentImageLoad = null;
		}

		if (this.#state.boundHandlers) {
			cleanupEventListeners(this.#state.boundHandlers, this.#state.elements.modal);
		}

		this.#state.elements.modal?.remove();

		// Reset state
		this.#state.isInitialized = false;
		this.#state.isOpen = false;
		this.#state.currentIndex = -1;
		this.#state.exifData = {};
		this.#state.originalTriggerElement = null;
		this.#state.elements = {};
		this.#state.boundHandlers = {};
		this.#state.galleryImagesCache = null;
		this.#state.captionTemplate = null;
		this.#state.focusableElements = [];
	}

	get isOpen() {
		return this.#state.isOpen;
	}

	openModal(src, alt, title, sourceElement = null, originalTriggerElement = null) {
		if (!src || !this.#state.isInitialized) {
			if (!src) console.warn('PhotoModal.openModal: src is required');
			return;
		}

		if (!this.#state.elements.modal) {
			console.error('PhotoModal: Modal elements not initialized');
			return;
		}

		const imageToLoad = this.#getBestImageSource(sourceElement) || src;

		// Cancel any pending image load
		if (this.#state.currentImageLoad) {
			this.#state.currentImageLoad.cancel();
		}

		// Open modal if not already open
		if (!this.#state.elements.modal.open) {
			this.#state.originalTriggerElement = originalTriggerElement || document.activeElement;
			try {
				this.#state.elements.modal.showModal();
				this.#state.isOpen = true;
				this.#trapFocus();
			} catch (error) {
				console.error('Failed to open modal:', error);
				this.#state.isOpen = false;
				return;
			}
		}

		// Show loading state
		if (this.#state.elements.modalCard) {
			this.#state.elements.modalCard.classList.add('loading');
		}

		// Load image
		const loadPromise = this.#createCancellableImageLoad(imageToLoad);
		this.#state.currentImageLoad = loadPromise;

		loadPromise.promise
			.then(() => {
				if (this.#state.currentImageLoad === loadPromise) {
					this.#updateModalContent(imageToLoad, alt, title);
				}
			})
			.catch(error => {
				if (this.#state.currentImageLoad === loadPromise) {
					if (error.name !== 'AbortError') {
						console.error('Image failed to load:', error);
						this.#updateModalContent(imageToLoad, alt, title);
					}
				}
			})
			.finally(() => {
				if (this.#state.currentImageLoad === loadPromise) {
					if (this.#state.elements.modalCard) {
						this.#state.elements.modalCard.classList.remove('loading');
					}
					this.#state.currentImageLoad = null;
				}
			});
	}

	closeModal() {
		if (!this.#state.isOpen || !this.#state.elements.modal) return;

		// Cancel any pending image load
		if (this.#state.currentImageLoad) {
			this.#state.currentImageLoad.cancel();
			this.#state.currentImageLoad = null;
		}

		try {
			this.#state.elements.modal.close();
			this.#state.isOpen = false;
			this.#restoreFocus();

			// Clear image
			if (this.#state.elements.modalImg) {
				this.#state.elements.modalImg.src = '';
				this.#state.elements.modalImg.alt = '';
				this.#state.elements.modalImg.title = '';
			}
		} catch (error) {
			console.error('Failed to close modal:', error);
			this.#state.isOpen = false;
		}
	}

	navigateImage(direction) {
		const allImages = this.#getAllGalleryImages();
		if (!allImages.length || this.#state.currentIndex < 0) {
			console.warn(`Navigation aborted. Image count: ${allImages.length}, Current Index: ${this.#state.currentIndex}`);
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

		const imgElement = targetImageElement.querySelector(SELECTORS.IMG);
		const alt = imgElement?.alt || '';
		const title = imgElement?.dataset?.title || '';

		this.openModal(targetSrc, alt, title, targetImageElement, null);
	}

	#createModal() {
		const template = document.getElementById(SELECTORS.MODAL_TEMPLATE.substring(1));
		if (!template) {
			throw new Error('Modal template not found.');
		}

		const templateContent = template.content.cloneNode(true);
		const modalDialog = templateContent.querySelector('dialog');
		if (!modalDialog) {
			throw new Error('<dialog> element not found in template.');
		}

		document.body.appendChild(modalDialog);

		this.#state.elements = {
			modal: modalDialog,
			modalCard: modalDialog.querySelector(SELECTORS.MODAL_CARD),
			modalImg: modalDialog.querySelector(SELECTORS.IMG),
			loader: modalDialog.querySelector('.modal-loader'),
			caption: modalDialog.querySelector(SELECTORS.MODAL_CAPTION),
			copyright: modalDialog.querySelector(SELECTORS.COPYRIGHT),
		};

		// Validate required elements
		if (!this.#state.elements.modal || !this.#state.elements.modalImg || !this.#state.elements.caption) {
			throw new Error('Required modal elements not found in template.');
		}
	}

	#cacheCaptionTemplate() {
		const template = document.getElementById(SELECTORS.MODAL_TEMPLATE.substring(1));
		if (template) {
			const captionEl = template.content.querySelector(SELECTORS.MODAL_CAPTION);
			if (captionEl) {
				this.#state.captionTemplate = captionEl.cloneNode(true);
			}
		}
	}

	#getBestImageSource(thumbElement) {
		if (!thumbElement) return '';

		const img = thumbElement.querySelector(SELECTORS.IMG);
		if (!img) return '';

		try {
			const sourcesAttr = img.getAttribute('data-sources');
			if (sourcesAttr) {
				const sources = JSON.parse(sourcesAttr);
				return sources.avif || Object.values(sources)[0] || img.src;
			}
		} catch (e) {
			console.error('Failed to parse data-sources attribute:', e);
		}

		return img.src;
	}

	/**
	 * Create a cancellable image load promise
	 * @private
	 * @param {string} src - Image source URL
	 * @returns {Object} Object with promise and cancel function
	 */
	#createCancellableImageLoad(src) {
		let cancelled = false;
		let img = null;
		let rejectFn = null;

		const promise = new Promise((resolve, reject) => {
			rejectFn = reject;
			img = new Image();

			img.onload = () => {
				if (!cancelled) {
					resolve(img);
				} else {
					const error = new Error('Image load cancelled');
					error.name = 'AbortError';
					reject(error);
				}
			};

			img.onerror = () => {
				if (!cancelled) {
					reject(new Error(`Failed to load image: ${src}`));
				} else {
					const error = new Error('Image load cancelled');
					error.name = 'AbortError';
					reject(error);
				}
			};

			img.src = src;
		});

		return {
			promise,
			cancel: () => {
				cancelled = true;
				if (img) {
					img.src = '';
					img.onload = null;
					img.onerror = null;
				}
				if (rejectFn) {
					const error = new Error('Image load cancelled');
					error.name = 'AbortError';
					rejectFn(error);
				}
			}
		};
	}

	#updateModalContent(src, alt, title) {
		if (!this.#state.elements.modalImg) return;

		const { modalImg } = this.#state.elements;
		modalImg.src = src;
		modalImg.alt = alt || 'Untitled';
		modalImg.title = alt || 'Untitled';

		this.#updateCurrentIndex(src);
		this.#updateCaption(title, src);

		// Announce image change for screen readers
		if (modalImg.hasAttribute('aria-live')) {
			modalImg.setAttribute('aria-label', `${title || alt || 'Image'} loaded`);
		}
	}

	/**
	 * Loads EXIF data from a JSON file using shared cache
	 * @private
	 */
	async #loadExifData() {
		try {
			this.#state.exifData = await dataCache.fetch('/json/exif-data.json');
		} catch (error) {
			console.warn('Could not load EXIF data:', error.message);
			this.#state.exifData = {};
		}
	}

	/**
	 * Updates the modal caption with title and EXIF data
	 * @private
	 */
	#updateCaption(title, imageSrc) {
		const { caption, copyright } = this.#state.elements;
		if (!caption) return;

		const exifData = findExifData(imageSrc, this.#state.exifData);

		// Use cached template if available
		if (this.#state.captionTemplate) {
			const freshCaptionContent = this.#state.captionTemplate.cloneNode(true);
			caption.replaceChildren(...freshCaptionContent.childNodes);
		} else {
			// Fallback: query template
			const template = document.getElementById(SELECTORS.MODAL_TEMPLATE.substring(1));
			if (template) {
				const freshCaptionContent = template.content.querySelector(SELECTORS.MODAL_CAPTION)?.cloneNode(true);
				if (freshCaptionContent) {
					caption.replaceChildren(...freshCaptionContent.childNodes);
				}
			}
		}

		const dateEl = caption.querySelector(SELECTORS.PHOTO_DATE);
		const titleEl = caption.querySelector(SELECTORS.TITLE);
		const gpsEl = caption.querySelector(SELECTORS.GPS);
		const altitudeEl = caption.querySelector(SELECTORS.ALTITUDE);
		const exifEl = caption.querySelector(SELECTORS.EXIF_ROW);
		const hrEl = caption.querySelector('hr');

		// Update date
		if (exifData?.date) {
			const dateString = formatExifDate(exifData.date);
			if (dateString && dateEl) {
				dateEl.dateTime = dateString;
				dateEl.textContent = dateString;
			} else if (dateEl) {
				dateEl.remove();
			}
		} else if (dateEl) {
			dateEl.remove();
		}

		// Update title
		if (titleEl) {
			titleEl.textContent = title || 'Untitled';
		}

		// Update GPS
		if (exifData?.gps && gpsEl) {
			const gpsElement = this.#createGPSElement(exifData.gps);
			if (gpsElement) {
				gpsEl.replaceChildren(gpsElement);
			} else {
				gpsEl.remove();
			}
		} else if (gpsEl) {
			gpsEl.remove();
		}

		// Update altitude
		if (exifData?.gps?.alt && altitudeEl) {
			const { display } = formatElevation(exifData.gps.alt);
			altitudeEl.textContent = display;
		} else if (altitudeEl) {
			altitudeEl.remove();
		}

		// Update EXIF data
		const exifElement = this.#createExifElement(exifData);
		if (exifElement && exifEl) {
			exifEl.replaceChildren(exifElement);
		} else {
			if (exifEl) exifEl.remove();
			if (hrEl) hrEl.remove();
		}

		// Update copyright
		if (copyright) {
			if (exifData?.copyright) {
				copyright.textContent = exifData.copyright;
				copyright.style.display = 'block';
			} else {
				copyright.textContent = '';
				copyright.style.display = 'none';
			}
		}
	}

	/**
	 * Creates GPS link as DOM element
	 * @private
	 */
	#createGPSElement(gps) {
		if (!gps?.lat || !gps?.lon) return null;

		const lat = parseFloat(gps.lat).toFixed(5);
		const lon = parseFloat(gps.lon).toFixed(5);
		const url = `https://caltopo.com/map.html#ll=${lat},${lon}&z=16&b=mbt`;

		const dataEl = document.createElement('data');
		dataEl.title = 'GPS Coordinates';
		dataEl.value = `${lat},${lon}`;

		const link = document.createElement('a');
		link.href = url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = `${gps.latDMS || lat}, ${gps.lonDMS || lon}`;

		dataEl.appendChild(link);
		return dataEl;
	}

	/**
	 * Creates EXIF data row as DOM element
	 * @private
	 */
	#createExifElement(photo) {
		if (!photo) return null;

		const parts = [];

		// Helper to create data parts
		const createDataPart = (label, value, unit = '') => {
			if (value === null || value === undefined) return null;

			const span = document.createElement('span');
			span.title = label;

			const data = document.createElement('data');
			data.value = String(value);
			data.textContent = String(value);
			span.appendChild(data);

			if (unit) {
				span.appendChild(document.createTextNode(unit));
			}

			return span;
		};

		// Helper to create span with text
		const createTextSpan = (title, text) => {
			const span = document.createElement('span');
			span.title = title;
			span.textContent = text;
			return span;
		};

		// Helper to create span with data element
		const createSpanWithData = (title, value, prefix = '') => {
			const span = document.createElement('span');
			span.title = title;
			if (prefix) {
				span.textContent = prefix;
			}

			const data = document.createElement('data');
			data.value = String(value);
			data.textContent = String(value);
			span.appendChild(data);

			return span;
		};

		// Camera model
		if (photo.cameraModel) {
			parts.push(createTextSpan('Camera Model', photo.cameraModel));
		}

		// ISO
		if (photo.iso) {
			parts.push(createSpanWithData('ISO Value', photo.iso, 'ISO '));
		}

		// Lens/Focal length
		if (photo.lens) {
			const part = createDataPart('Focal Length', photo.lens, ' mm');
			if (part) parts.push(part);
		}

		// Exposure compensation
		if (photo.exposureCompensation !== undefined && photo.exposureCompensation !== null) {
			const evNum = parseFloat(photo.exposureCompensation);
			const evStr = evNum === 0 ? '0' : evNum.toFixed(2);
			const part = createDataPart('Exposure Compensation', evStr, ' ev');
			if (part) parts.push(part);
		}

		// Aperture
		if (photo.aperture) {
			const span = document.createElement('span');
			span.title = 'Aperture Size';

			const italic = document.createElement('i');
			italic.innerHTML = '&#402;';
			span.appendChild(italic);
			span.appendChild(document.createTextNode(' '));

			const data = document.createElement('data');
			data.value = String(photo.aperture);
			data.textContent = String(photo.aperture);
			span.appendChild(data);

			parts.push(span);
		}

		// Shutter speed
		if (photo.shutter) {
			const part = createDataPart('Shutter Speed', photo.shutter, 's');
			if (part) parts.push(part);
		}

		// Format
		if (photo.format) {
			const span = document.createElement('span');
			span.className = 'format';
			span.title = 'File Format';

			const data = document.createElement('data');
			data.value = String(photo.format);
			data.textContent = String(photo.format);
			span.appendChild(data);

			parts.push(span);
		}

		if (parts.length === 0) return null;

		// Combine parts with separators
		const container = document.createElement('span');
		parts.forEach((part, index) => {
			container.appendChild(part);
			if (index < parts.length - 1) {
				const separator = document.createElement('span');
				separator.textContent = ' | ';
				container.appendChild(separator);
			}
		});

		return container;
	}

	/**
	 * Updates the current image index by comparing normalized pathnames.
	 * @private
	 */
	#updateCurrentIndex(src) {
		const allImages = this.#getAllGalleryImages();
		if (!allImages.length) {
			this.#state.currentIndex = -1;
			return;
		}

		const currentImagePath = new URL(src, window.location.origin).pathname;

		this.#state.currentIndex = allImages.findIndex(galleryImg => {
			const bestSourceForThumb = this.#getBestImageSource(galleryImg);
			if (!bestSourceForThumb) return false;

			const candidatePath = new URL(bestSourceForThumb, window.location.origin).pathname;
			return currentImagePath === candidatePath;
		});
	}

	/**
	 * Gets all gallery images with caching.
	 * @private
	 */
	#getAllGalleryImages() {
		// Invalidate cache if DOM might have changed
		// For now, we'll cache but allow manual invalidation
		if (this.#state.galleryImagesCache === null) {
			this.#state.galleryImagesCache = Array.from(document.querySelectorAll(SELECTORS.PHOTO_THUMB));
		}
		return this.#state.galleryImagesCache;
	}

	/**
	 * Invalidates the gallery images cache (call when gallery changes)
	 * @public
	 */
	invalidateGalleryCache() {
		this.#state.galleryImagesCache = null;
	}

	/**
	 * Trap focus within modal for accessibility
	 * @private
	 */
	#trapFocus() {
		if (!this.#state.elements.modal) return;

		// Find all focusable elements in modal
		const focusableSelectors = [
			'a[href]',
			'button:not([disabled])',
			'textarea:not([disabled])',
			'input:not([disabled])',
			'select:not([disabled])',
			'[tabindex]:not([tabindex="-1"])'
		].join(', ');

		this.#state.focusableElements = Array.from(
			this.#state.elements.modal.querySelectorAll(focusableSelectors)
		).filter(el => {
			const style = window.getComputedStyle(el);
			return style.display !== 'none' && style.visibility !== 'hidden';
		});

		// Focus first element or modal itself
		if (this.#state.focusableElements.length > 0) {
			this.#state.focusableElements[0].focus();
		} else {
			this.#state.elements.modal.focus();
		}
	}

	/**
	 * Restore focus to original trigger element
	 * @private
	 */
	#restoreFocus() {
		if (this.#state.originalTriggerElement) {
			try {
				this.#state.originalTriggerElement.focus();
			} catch (error) {
				// Element might not be focusable
				console.warn('Could not restore focus:', error);
			}
		}
		this.#state.originalTriggerElement = null;
	}
}
