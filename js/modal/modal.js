/**
 * Modal
 * @file PhotoModal.js
 * @description A modern, robust photo modal with EXIF data support.
 **/
import {
	setupEventListeners,
	cleanupEventListeners
} from './modal-events.js';
import dataCache from '../shared-data.js';
import { formatExifDate, formatElevation, findExifData } from '../shared-utils.js';


export class PhotoModal {
	#state = {
		isInitialized: false,
		isOpen: false,
		currentIndex: -1,
		exifData: {},
		originalTriggerElement: null,
		elements: {},
		boundHandlers: {},
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

		if (!this.#state.elements.modal.open) {
			this.#state.originalTriggerElement = originalTriggerElement || document.activeElement;
			this.#state.elements.modal.showModal();
			this.#state.isOpen = true;
		}

		this.#state.elements.modalContent.classList.add('loading');
		this.#loadImage(imageToLoad)
			.then(loadedImg => {
				this.#updateModalContent(imageToLoad, alt, title, loadedImg);
				this.#state.elements.modalImg.title = `${alt}`;
			})
			.catch(error => {
				console.warn('Image failed to load, opening modal without it:', error);
				this.#updateModalContent(imageToLoad, alt, title, null);
			})
			.finally(() => {
				this.#state.elements.modalContent.classList.remove('loading');
			});
	}

	closeModal() {
		if (!this.#state.isOpen) return;

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
			// Use shared cache instead of direct fetch
			this.#state.exifData = await dataCache.fetch('/json/exif-data.json');
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
		if (!Object.keys(this.#state.exifData)
			.length) {
			return {};
		}

		try {
			const url = new URL(imageSrc, window.location.origin);
			const normalizedSrcPath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
			const srcPathLower = normalizedSrcPath.toLowerCase();
			const srcFilename = normalizedSrcPath.split('/')
				.pop()
				.toLowerCase();
			const srcBaseFilename = srcFilename.split('.')[0];
			const srcExtension = srcFilename.split('.')
				.pop();

			const candidates = [];
			for (const [key, data] of Object.entries(this.#state.exifData)) {
				const keyBase = key.split('/')
					.pop()
					.toLowerCase()
					.split('.')[0];
				if (keyBase === srcBaseFilename) {
					candidates.push({ key, data });
				}
			}

			if (candidates.length === 0) return {};
			if (candidates.length === 1) return candidates[0].data;

			const exactMatch = candidates.find(c => c.key.toLowerCase() === srcPathLower);
			if (exactMatch) return exactMatch.data;

			const extensionMatch = candidates.find(c => {
				const keyExtension = c.key.split('.')
					.pop()
					.toLowerCase();
				return keyExtension === srcExtension;
			});
			if (extensionMatch) return extensionMatch.data;

			console.warn(`Multiple EXIF candidates found for "${srcBaseFilename}" with no definitive match. Returning the first one.`);
			return candidates[0].data;
		} catch (error) {
			console.warn('Error finding EXIF data:', error);
		}

		return {};
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