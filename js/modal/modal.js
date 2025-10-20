/**
 * @file PhotoModal.js
 * @description A modern, robust photo modal with EXIF data support.
 */
import {
	setupEventListeners,
	cleanupEventListeners
} from './modal-events.js';

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

	/**
	 * Initializes the modal by creating elements and setting up listeners.
	 * This should only be called once.
	 */
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
			console.log('PhotoModal initialized successfully.');
		} catch (error) {
			console.error('Failed to initialize PhotoModal:', error);
			this.#state.isInitialized = false;
		}
	}

	get isOpen() {
		return this.#state.isOpen;
	}

	openModal(src, alt, title, sourceElement = null, originalTriggerElement = null) {
		if (!src) {
			return;
		}
		
		const imageToLoad = this.#getBestImageSource(sourceElement) || src;

		// Only update trigger element and show modal if it's not already open
		if (!this.#state.elements.modal.open) {
			this.#state.originalTriggerElement = originalTriggerElement || document.activeElement;
			this.#state.elements.modal.showModal();
			this.#state.isOpen = true;
		}

		// Show loader and load the image
		this.#state.elements.modalContent.classList.add('loading');
		this.#loadImage(imageToLoad)
			.then(loadedImg => {
				this.#updateModalContent(imageToLoad, alt, title, loadedImg);
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
		// Clear the image source when the modal closes
		this.#state.elements.modalImg.src = '';
		this.#state.elements.modalImg.title = 'Loading...';
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
		const alt = (imgElement && imgElement.alt) || '';
		const title = (imgElement && imgElement.dataset && imgElement.dataset.title) || '';

		this.openModal(targetSrc, alt, title, targetImageElement, null);
	}

	// --- Private Methods ---

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

	#updateModalContent(src, alt, title, loadedImg) {
		const { modalImg } = this.#state.elements;
		modalImg.src = src;
		modalImg.alt = alt || 'Untitled';
		this.#updateCurrentIndex(src);
		this.#updateCaption(title, src);
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
			const srcFilename = normalizedSrcPath.split('/').pop().toLowerCase();
			const srcParts = srcFilename.split('.');
			const srcBaseFilename = srcParts[0];
			const srcExtension = srcParts.length > 1 ? srcParts.pop() : '';

			const candidates = [];
			for (const [key, data] of Object.entries(this.#state.exifData)) {
				const keyBase = key.split('/').pop().toLowerCase().split('.')[0];
				if (keyBase === srcBaseFilename) {
					candidates.push({ key, data });
				}
			}

			if (candidates.length === 0) return {};
			if (candidates.length === 1) return candidates[0].data;

			const exactMatch = candidates.find(c => c.key.toLowerCase() === srcPathLower);
			if (exactMatch) return exactMatch.data;

			const extensionMatch = candidates.find(c => {
				const keyExtension = c.key.split('.').pop().toLowerCase();
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
	 * Updates the modal caption with a title and EXIF data.
	 * @private
	 */
	#updateCaption(title, imageSrc, sourceElement) {
		const { caption, modal, copyright } = this.#state.elements;
		const exifData = this.#findExifData(imageSrc);

		const template = document.getElementById('photo-modal-template');
		if (!template) return;
		const freshCaptionContent = template.content.querySelector('.modal-caption').cloneNode(true);
		caption.replaceChildren(...freshCaptionContent.childNodes);

		const dateEl = caption.querySelector('.photo-date');
		const titleEl = caption.querySelector('.title');
		const gpsEl = caption.querySelector('.gps');
		const altitudeEl = caption.querySelector('.altitude');
		const exifEl = caption.querySelector('.exif-row');
		const hrEl = caption.querySelector('hr');

		if (exifData?.date) {
			const { year, month, day } = exifData.date;
			const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			dateEl.dateTime = dateString;
			dateEl.textContent = dateString;
		} else {
			dateEl.remove();
		}

		const escapedTitle = title || 'Untitled';
		titleEl.textContent = escapedTitle;

		if (exifData?.gps) {
			gpsEl.innerHTML = this.#buildGPSLink(exifData.gps);
		} else {
			gpsEl.remove();
		}

		if (exifData?.gps?.alt) {
			altitudeEl.textContent = `${Math.round(exifData.gps.alt * 3.28084).toLocaleString()} ft`;
		} else {
			altitudeEl.remove();
		}

		const exifRowHTML = this.#buildExifRow(exifData, (text) => text);
		if (exifRowHTML) {
			exifEl.innerHTML = exifRowHTML;
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
	 * Builds the GPS link HTML.
	 * @private
	 */
	#buildGPSLink(gps) {
		if (!gps || !gps.lat || !gps.lon) return '';
		const lat = parseFloat(gps.lat).toFixed(5);
		const lon = parseFloat(gps.lon).toFixed(5);
		const url = `https://caltopo.com/map.html#ll=${lat},${lon}&z=16&b=mbt`;
		const latDMS = gps.latDMS || lat;
		const lonDMS = gps.lonDMS || lon;
		return `<data title="GPS Coordinates"value="${lat},${lon}">
				<a href="${url}" target="_blank" rel="noopener noreferrer">${latDMS}<wbr>, ${lonDMS}<wbr></a>
				</data>`;
	}

	/**
	 * Builds the EXIF data row HTML.
	 * @private
	 */
	#buildExifRow(photo, escapeHTML) {
		const parts = [
			photo.cameraModel ? `<span title="Camera Model">${photo.cameraModel}</span>` : '',
			photo.iso ? `<span title="ISO Value">ISO <data value="${photo.iso}">${photo.iso}</data></span>` : '',
			photo.lens ? `<span title="Focal Length"><data value="${escapeHTML(photo.lens)}">${escapeHTML(photo.lens)}</data>mm</span>` : '',
			photo.exposureCompensation ?
			  (() => {
				const evNum = parseFloat(photo.exposureCompensation);
				const evStr = evNum === 0 ? "0" : evNum.toFixed(2);
				return `<span title="Exposure Compensation"><data value="${escapeHTML(evStr)}">${escapeHTML(evStr)}</data> ev</span>`;
			  })() : '',
			photo.aperture ? `<span title="Aperature Size"><i>&#402;</i> <data value="${photo.aperture}">${photo.aperture}</data></span>` : '',
			photo.shutter ? `<span title="Shutter Speed"><data value="${photo.shutter}">${photo.shutter}</data>s</span>` : '',
			photo.format ? `<span class="format" title="File Format"><data value="${escapeHTML(photo.format)}">${escapeHTML(photo.format)}</data></span>` : ''
		].filter(Boolean);
		return parts.join('<span>|</span>');
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
			if (!bestSourceForThumb) return false;
			const candidatePath = new URL(bestSourceForThumb, window.location.origin).pathname;
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