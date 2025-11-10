/**
 * Photo Modal - Simplified
 */
import dataCache from '../utils/shared-data.js';
import { formatExifDate, formatElevation, findExifData } from '../utils/exif-utils.js';

export class PhotoModal {
	constructor() {
		this.isOpen = false;
		this.currentIndex = -1;
		this.exifData = {};
		this.originalTrigger = null;
		this.elements = {};
		this.imageAbortController = null;
	}

	async initialize() {
		this.createModal();
		this.setupEventListeners();
		await this.loadExifData();
	}

	setupEventListeners() {
		// Click handler - photo thumbs, camera links, backdrop
		document.addEventListener('click', (e) => {
			// Close on backdrop click
			if (this.isOpen && e.target === this.elements.modal) {
				this.closeModal();
				return;
			}

			// Open photo thumb
			const photoThumb = e.target.closest('.photo-thumb');
			if (photoThumb) {
				e.preventDefault();
				e.stopPropagation(); // Add this line
				const img = photoThumb.querySelector('img');
				if (img) {
					this.openModal(img.src, img.alt, img.dataset.title, photoThumb, photoThumb);
				}
				return;
			}
			
			// Open camera link (mountain table)
			const cameraLink = e.target.closest('.camera-link');
			if (cameraLink) {
				e.preventDefault();
				e.stopPropagation(); // Add this line
				const imageUrl = cameraLink.dataset.image;
				const peakName = cameraLink.dataset.title;
				if (imageUrl) {
					this.openModal(imageUrl, peakName || 'Peak image', peakName, cameraLink, cameraLink);
				}
			}
		});

		// Keyboard navigation
		document.addEventListener('keydown', (e) => {
			if (!this.isOpen) return;

			if (e.key === 'Escape') {
				e.preventDefault();
				this.closeModal();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				this.navigateImage(1);
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				this.navigateImage(-1);
			}
		});
	}

	destroy() {
		this.imageAbortController?.abort();
		this.elements.modal?.remove();
		
		// Event listeners are removed when modal element is removed
		this.isOpen = false;
		this.currentIndex = -1;
		this.exifData = {};
		this.elements = {};
	}

	createModal() {
		const template = document.getElementById('photo-modal-template');
		if (!template) throw new Error('Modal template not found');

		const dialog = template.content.cloneNode(true).querySelector('dialog');
		document.body.appendChild(dialog);

		this.elements = {
			modal: dialog,
			modalImg: dialog.querySelector('img'),
			caption: dialog.querySelector('.modal-caption'),
			copyright: dialog.querySelector('.copyright')
		};
	}

	openModal(src, alt, title, sourceElement = null, originalTrigger = null) {
		if (!src) return;
		
		const imageUrl = this.getBestImageSource(sourceElement) || src;
		
		// Cancel any pending image load
		this.imageAbortController?.abort();
		this.imageAbortController = new AbortController();
		
		if (!this.elements.modal.open) {
			this.originalTrigger = originalTrigger || document.activeElement;
			this.elements.modal.showModal();
			this.isOpen = true;
		}
		
		// Clear old content immediately
		this.elements.modalImg.src = '';
		this.elements.modalImg.alt = '';
		this.elements.modalImg.title = '';
		this.elements.caption.innerHTML = '';
		
		// Load image
		const img = new Image();
		const signal = this.imageAbortController.signal;
		
		img.onload = () => {
			if (signal.aborted) return;
			
			this.elements.modalImg.src = imageUrl;
			this.elements.modalImg.alt = alt || 'Untitled';
			this.elements.modalImg.title = alt;
			
			this.updateCurrentIndex(imageUrl);
			this.updateCaption(title, imageUrl);
		};

		img.onerror = () => {
			if (signal.aborted) return;
			console.error('Failed to load image:', imageUrl);
		};

		signal.addEventListener('abort', () => {
			img.src = '';
			img.onload = null;
			img.onerror = null;
		});

		img.src = imageUrl;
	}

	closeModal() {
		if (!this.isOpen) return;

		this.imageAbortController?.abort();
		this.elements.modal.close();
		this.isOpen = false;
		this.elements.modalImg.src = '';
		this.elements.modalImg.title = '';
		
		// Restore focus
		if (this.originalTrigger) {
			this.originalTrigger.focus();
		}
	}

	navigateImage(direction) {
		const allImages = this.getAllGalleryImages();
		if (!allImages.length || this.currentIndex < 0) return;

		const newIndex = (this.currentIndex + direction + allImages.length) % allImages.length;
		const targetElement = allImages[newIndex];
		const targetSrc = this.getBestImageSource(targetElement);
		
		if (!targetSrc) return;

		const img = targetElement.querySelector('img');
		const alt = img?.alt || '';
		const title = img?.dataset?.title || '';

		this.openModal(targetSrc, alt, title, targetElement, null);
	}

	getBestImageSource(thumbElement) {
		const img = thumbElement?.querySelector('img');
		if (!img) return '';

		try {
			const sourcesAttr = img.getAttribute('data-sources');
			if (sourcesAttr) {
				const sources = JSON.parse(sourcesAttr);
				return sources.avif || Object.values(sources)[0] || img.src;
			}
		} catch (e) {
			console.error('Failed to parse data-sources:', e);
		}

		return img.src;
	}

	async loadExifData() {
		try {
			this.exifData = await dataCache.fetch('/json/exif-data.json');
		} catch (error) {
			console.warn('Could not load EXIF data:', error);
			this.exifData = {};
		}
	}

	updateCaption(title, imageSrc) {
		const exif = findExifData(imageSrc, this.exifData);
		
		// Build caption HTML
		let captionHTML = '<div class="caption-header">';
		
		// Date
		if (exif?.date) {
			const dateStr = formatExifDate(exif.date);
			if (dateStr) {
				captionHTML += `<time class="photo-date" datetime="${dateStr}">${dateStr}</time>`;
			}
		}
		
		// Title
		captionHTML += `<h5 class="title">${title || 'Untitled'}</h5>`;
		
		// Altitude
		if (exif?.gps?.alt) {
			const { display } = formatElevation(exif.gps.alt);
			captionHTML += `<data class="altitude">${display}</data>`;
		}
		
		// GPS
		if (exif?.gps?.lat && exif?.gps?.lon) {
			const lat = parseFloat(exif.gps.lat).toFixed(5);
			const lon = parseFloat(exif.gps.lon).toFixed(5);
			const url = `https://caltopo.com/map.html#ll=${lat},${lon}&z=16&b=mbt`;
			const display = `${exif.gps.latDMS || lat}, ${exif.gps.lonDMS || lon}`;
			captionHTML += `<span class="gps"><data title="GPS Coordinates" value="${lat},${lon}">
				<a href="${url}" target="_blank" rel="noopener noreferrer">${display}</a>
			</data></span>`;
		}
		
		captionHTML += '</div>';
		
		// EXIF row
		const exifRow = this.buildExifRow(exif);
		if (exifRow) {
			captionHTML += '<hr><span class="exif-row">' + exifRow + '</span>';
		}
		
		this.elements.caption.innerHTML = captionHTML;
		
		// Copyright
		if (this.elements.copyright) {
			if (exif?.copyright) {
				this.elements.copyright.textContent = exif.copyright;
				this.elements.copyright.style.display = 'block';
			} else {
				this.elements.copyright.textContent = '';
				this.elements.copyright.style.display = 'none';
			}
		}
	}

	buildExifRow(exif) {
		if (!exif) return '';
		
		const parts = [];
		
		if (exif.cameraModel) {
			parts.push(`<span title="Camera Model">${exif.cameraModel}</span>`);
		}
		
		if (exif.iso) {
			parts.push(`<span title="ISO Value">ISO <data value="${exif.iso}">${exif.iso}</data></span>`);
		}
		
		if (exif.lens) {
			parts.push(`<span title="Focal Length"><data value="${exif.lens}">${exif.lens}</data> mm</span>`);
		}
		
		if (exif.exposureCompensation) {
			const ev = parseFloat(exif.exposureCompensation);
			const evStr = ev === 0 ? '0' : ev.toFixed(2);
			parts.push(`<span title="Exposure Compensation"><data value="${evStr}">${evStr}</data> ev</span>`);
		}
		
		if (exif.aperture) {
			parts.push(`<span title="Aperture Size"><i>&#402;</i> <data value="${exif.aperture}">${exif.aperture}</data></span>`);
		}
		
		if (exif.shutter) {
			parts.push(`<span title="Shutter Speed"><data value="${exif.shutter}">${exif.shutter}</data>s</span>`);
		}
		
		if (exif.format) {
			parts.push(`<span class="format" title="File Format"><data value="${exif.format}">${exif.format}</data></span>`);
		}
		
		return parts.join(' | ');
	}

	updateCurrentIndex(src) {
		const allImages = this.getAllGalleryImages();
		const currentPath = new URL(src, window.location.origin).pathname;

		this.currentIndex = allImages.findIndex(thumbEl => {
			const thumbSrc = this.getBestImageSource(thumbEl);
			if (!thumbSrc) return false;
			const thumbPath = new URL(thumbSrc, window.location.origin).pathname;
			return currentPath === thumbPath;
		});
	}

	getAllGalleryImages() {
		return Array.from(document.querySelectorAll('.photo-thumb'));
	}

	// Methods called by galleries.js
	setupAspectRatios() {
		// Placeholder for any aspect ratio setup if needed
	}

	refreshImageTracking() {
		// Re-scan for images after gallery changes
		// Index will be recalculated on next open
	}
}