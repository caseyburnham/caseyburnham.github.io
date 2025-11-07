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


export class PhotoModal {
	#state = {
		isInitialized: false,
		isOpen: false,
		currentIndex: -1,
		exifData: {},
		originalTriggerElement: null,
		elements: {},
		boundHandlers: {},
		currentImageLoad: null
	};

	async initialize() {
		if (this.#state.isInitialized) {
			console.warn('PhotoModal is already initialized.');
			return;
		}

		try {
			this.#createModal();
			this.#state.boundHandlers = setupEventListeners(this.#state.elements, this);
			await this.#loadExifData();
			this.#state.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize PhotoModal:', error);
			this.#state.isInitialized = false;
		}
	}

	destroy() {
		if (!this.#state.isInitialized) return;

		if (this.#state.currentImageLoad) {
			this.#state.currentImageLoad.cancel();
			this.#state.currentImageLoad = null;
		}

		if (this.#state.boundHandlers) {
			cleanupEventListeners(this.#state.boundHandlers);
		}

		this.#state.elements.modal?.remove();

		this.#state.isInitialized = false;
		this.#state.isOpen = false;
		this.#state.currentIndex = -1;
		this.#state.exifData = {};
		this.#state.originalTriggerElement = null;
		this.#state.elements = {};
		this.#state.boundHandlers = {};
	}

	get isOpen() {
		return this.#state.isOpen;
	}

	openModal(src, alt, title, sourceElement = null, originalTriggerElement = null) {
		if (!src) return;

		const imageToLoad = this.#getBestImageSource(sourceElement) || src;

		if (this.#state.currentImageLoad) {
			this.#state.currentImageLoad.cancel();
		}

		if (!this.#state.elements.modal.open) {
			this.#state.originalTriggerElement = originalTriggerElement || document.activeElement;
			this.#state.elements.modal.showModal();
			this.#state.isOpen = true;
		}

		this.#state.elements.modalContent.classList.add('loading');

		const loadPromise = this.#createCancellableImageLoad(imageToLoad);
		this.#state.currentImageLoad = loadPromise;

		loadPromise.promise
			.then(loadedImg => {
				if (this.#state.currentImageLoad === loadPromise) {
					this.#updateModalContent(imageToLoad, alt, title, loadedImg);
					this.#state.elements.modalImg.title = `${alt}`;
				}
			})
			.catch(error => {
				if (this.#state.currentImageLoad === loadPromise) {
					if (error.name !== 'AbortError') {
						console.error('Image failed to load:', error);
						this.#updateModalContent(imageToLoad, alt, title, null);
					}
				}
			})
			.finally(() => {
				if (this.#state.currentImageLoad === loadPromise) {
					this.#state.elements.modalContent.classList.remove('loading');
					this.#state.currentImageLoad = null;
				}
			});
	}

	closeModal() {
		if (!this.#state.isOpen) return;

		if (this.#state.currentImageLoad) {
			this.#state.currentImageLoad.cancel();
			this.#state.currentImageLoad = null;
		}

		this.#state.elements.modal.close();
		this.#state.isOpen = false;

		this.#state.elements.modalImg.src = '';
		this.#state.elements.modalImg.title = '';
	}

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
		const alt = imgElement?.alt || '';
		const title = imgElement?.dataset?.title || '';

		this.openModal(targetSrc, alt, title, targetImageElement, null);
	}

	#createModal() {
		const template = document.getElementById('photo-modal-template');
		if (!template) throw new Error('Modal template not found.');

		const templateContent = template.content.cloneNode(true);
		const modalDialog = templateContent.querySelector('dialog');
		if (!modalDialog) throw new Error('<dialog> element not found in template.');

		document.body.appendChild(modalDialog);

		this.#state.elements = {
			modal: modalDialog,
			modalContent: modalDialog,
			modalImg: modalDialog.querySelector('img'),
			loader: modalDialog.querySelector('.modal-loader'),
			caption: modalDialog.querySelector('.modal-caption'),
			copyright: modalDialog.querySelector('.copyright'),
			modalCard: modalDialog.querySelector('.modal-card'),
		};
	}

	#getBestImageSource(thumbElement) {
		const img = thumbElement?.querySelector('img');
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

		const promise = new Promise((resolve, reject) => {
			img = new Image();

			img.onload = () => {
				if (!cancelled) {
					resolve(img);
				}
			};

			img.onerror = () => {
				if (!cancelled) {
					reject(new Error(`Failed to load image: ${src}`));
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
				const error = new Error('Image load cancelled');
				error.name = 'AbortError';
			}
		};
	}

	#loadImage(src) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
			img.src = src;
		});
	}

	#updateModalContent(src, alt, title) {
		const { modalImg } = this.#state.elements;
		modalImg.src = src;
		modalImg.alt = alt || 'Untitled';
		this.#updateCurrentIndex(src);
		this.#updateCaption(title, src);
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
		const exifData = findExifData(imageSrc, this.#state.exifData);

		const template = document.getElementById('photo-modal-template');
		if (!template) return;

		const freshCaptionContent = template.content.querySelector('.modal-caption')
			.cloneNode(true);
		caption.replaceChildren(...freshCaptionContent.childNodes);

		const dateEl = caption.querySelector('.photo-date');
		const titleEl = caption.querySelector('.title');
		const gpsEl = caption.querySelector('.gps');
		const altitudeEl = caption.querySelector('.altitude');
		const exifEl = caption.querySelector('.exif-row');
		const hrEl = caption.querySelector('hr');

		if (exifData?.date) {
			const dateString = formatExifDate(exifData.date);
			if (dateString) {
				dateEl.dateTime = dateString;
				dateEl.textContent = dateString;
			} else {
				dateEl.remove();
			}
		} else {
			dateEl.remove();
		}

		titleEl.textContent = title || 'Untitled';

		if (exifData?.gps) {
			const gpsElement = this.#createGPSElement(exifData.gps);
			gpsEl.replaceChildren(gpsElement);
		} else {
			gpsEl.remove();
		}

		if (exifData?.gps?.alt) {
			const { display } = formatElevation(exifData.gps.alt);
			altitudeEl.textContent = display;
		} else {
			altitudeEl.remove();
		}

		const exifElement = this.#createExifElement(exifData);
		if (exifElement) {
			exifEl.replaceChildren(exifElement);
		} else {
			exifEl.remove();
			hrEl.remove();
		}

		if (copyright && exifData?.copyright) {
			copyright.textContent = exifData.copyright;
			copyright.style.display = 'block';
		} else if (copyright) {
			copyright.textContent = '';
			copyright.style.display = 'none';
		}
	}

	/**
	 * Creates GPS link as DOM element
	 * @private
	 */
	#createGPSElement(gps) {
		if (!gps?.lat || !gps?.lon) return null;

		const lat = parseFloat(gps.lat)
			.toFixed(5);
		const lon = parseFloat(gps.lon)
			.toFixed(5);
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

		const createDataPart = (label, value, unit = '') => {
			const span = document.createElement('span');
			span.title = label;

			if (value !== null && value !== undefined) {
				const data = document.createElement('data');
				data.value = String(value);
				data.textContent = String(value);
				span.appendChild(data);

				if (unit) {
					span.appendChild(document.createTextNode(unit));
				}
			}

			return span;
		};

		if (photo.cameraModel) {
			const span = document.createElement('span');
			span.title = 'Camera Model';
			span.textContent = photo.cameraModel;
			parts.push(span);
		}

		if (photo.iso) {
			const span = document.createElement('span');
			span.title = 'ISO Value';
			span.textContent = 'ISO ';

			const data = document.createElement('data');
			data.value = String(photo.iso);
			data.textContent = String(photo.iso);

			span.appendChild(data);
			parts.push(span);
		}

		if (photo.lens) {
			parts.push(createDataPart('Focal Length', photo.lens, ' mm'));
		}

		if (photo.exposureCompensation) {
			const evNum = parseFloat(photo.exposureCompensation);
			const evStr = evNum === 0 ? '0' : evNum.toFixed(2);
			parts.push(createDataPart('Exposure Compensation', evStr, ' ev'));
		}

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

		if (photo.shutter) {
			parts.push(createDataPart('Shutter Speed', photo.shutter, 's'));
		}

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
		const currentImagePath = new URL(src, window.location.origin)
			.pathname;

		this.#state.currentIndex = allImages.findIndex(galleryImg => {
			const bestSourceForThumb = this.#getBestImageSource(galleryImg);
			if (!bestSourceForThumb) return false;

			const candidatePath = new URL(bestSourceForThumb, window.location.origin)
				.pathname;
			return currentImagePath === candidatePath;
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