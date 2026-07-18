import dataCache from '../utils/shared-data.js';
import { formatExifDate, formatElevation, findExifData } from '../utils/exif-utils.js';

const hasExifValue = value =>
	value != null &&
	String(value).trim() !== '' &&
	String(value).trim().toLowerCase() !== 'unknown';

export class PhotoModal {
	constructor(galleryContainerSelector = '.photo-gallery') {
		this.exifData = {};
		this.elements = {};
		this.photos = [];
		this.currentIndex = -1;
		this.container = document.querySelector(galleryContainerSelector) || document.body;
		this.abortController = new AbortController();
	}

	async initialize() {
		this._createModal();
		this._setupEventListeners();

		this.exifData = await dataCache.fetch('/json/exif-data.json').catch(() => ({}));
	}

	_createModal() {
		const template = document.getElementById('photo-modal-template');
		if (!template) throw new Error('Modal template missing.');

		const fragment = template.content.cloneNode(true);
		const dialog = fragment.querySelector('dialog');
		document.body.appendChild(dialog);

		const query = selector => dialog.querySelector(selector);
		this.elements = {
			modal: dialog,
			image: query('.modal-image'),
			title: query('.photo-title'),
			metadata: query('.photo-metadata'),
			date: query('.photo-date'),
			altitude: query('.altitude'),
			gpsRow: query('.gps'),
			gpsLabel: query('.gps-label'),
			gpsData: query('.gps-data'),
			gpsLink: query('.gps-link'),
			specs: [...dialog.querySelectorAll('[data-spec]')],
			copyright: query('.copyright'),
			previous: query('.dialog-previous'),
			next: query('.dialog-next')
		};
	}

	_setupEventListeners() {
		const { signal } = this.abortController;

		this.container.addEventListener('click', (e) => {
			const trigger = e.target.closest('.photo-thumb, .camera-link');
			if (!trigger) return;

			e.preventDefault();
			this.open(trigger);
		}, { signal });

		this.elements.modal.addEventListener('click', (e) => {
			if (e.target === this.elements.modal) {
				this.close();
			}
		}, { signal });
		
		this.elements.modal.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				this.navigate(1);
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				this.navigate(-1);
			}
		}, { signal });

		this.elements.previous.addEventListener('click', () => this.navigate(-1), { signal });
		this.elements.next.addEventListener('click', () => this.navigate(1), { signal });
		this.elements.modal.addEventListener('close', () => this._handleClose(), { signal });
	}

	/**
	 * @param {HTMLElement}
	 */
	open(trigger) {
		const img = trigger.querySelector('img') || trigger;
		const src = this._getBestSource(trigger);
		const title = trigger.dataset.title || img.dataset?.title || 'Untitled';
		if (!src) return;

		const itemSelector = trigger.matches('.camera-link')
			? '.camera-link'
			: '.photo-thumb';

		this.photos = Array.from(this.container.querySelectorAll(itemSelector));
		this.currentIndex = this.photos.indexOf(trigger.closest(itemSelector));

		this._render(src, img.alt, title);
		this._updateNavigation();
		
		if (!this.elements.modal.open) {
			this.originalTrigger = trigger;
			this.elements.modal.showModal();
		}
	}

	_render(src, alt, title) {
		const { image, title: titleEl } = this.elements;

		image.src = src;
		image.alt = alt || title;
		titleEl.textContent = title;

		this._renderMetadata(src);
	}

	_renderMetadata(src) {
		const exif = findExifData(src, this.exifData);
		const {
			metadata,
			date,
			altitude,
			gpsRow,
			gpsLabel,
			gpsData,
			gpsLink,
			specs,
			copyright
		} = this.elements;
	
		if (!exif) {
			metadata.hidden = true;
			copyright.hidden = true;
			return;
		}
		metadata.hidden = false;

		const dateStr = formatExifDate(exif.date);
		date.textContent = dateStr || '';
		date.dateTime = dateStr || '';
		date.parentElement.hidden = !dateStr;
	
		const altitudeValue = exif.gps?.alt;
		const hasAltitude =
			hasExifValue(altitudeValue) &&
			Number.isFinite(Number(altitudeValue));
		altitude.parentElement.hidden = !hasAltitude;
		if (hasAltitude) {
			const { display, feetRaw } = formatElevation(altitudeValue);
			altitude.textContent = display;
			altitude.value = feetRaw;
		} else {
			altitude.textContent = '';
			altitude.value = '';
		}
		
		const latitude = exif.gps?.lat;
		const longitude = exif.gps?.lon;
		const hasCoordinates =
			hasExifValue(latitude) &&
			hasExifValue(longitude) &&
			Number.isFinite(Number(latitude)) &&
			Number.isFinite(Number(longitude));

		if (hasCoordinates) {
			const { lat, lon, latDMS, lonDMS } = exif.gps;
			const coords = `${lat}, ${lon}`;
			
			gpsData.title = coords;
			gpsData.value = coords;
			gpsData.textContent = latDMS && lonDMS ? `${latDMS}, ${lonDMS}` : coords;
			gpsLink.href = `https://caltopo.com/map.html#ll=${lat},${lon}&z=16&b=mbt`;
			
			gpsRow.hidden = false;
			gpsLabel.hidden = false;
		} else {
			gpsRow.hidden = true;
			gpsLabel.hidden = true;
			gpsData.textContent = '';
			gpsData.value = '';
			gpsData.title = '';
			gpsLink.removeAttribute('href');
		}
	
		specs.forEach(spec => {
			const key = spec.dataset.spec;
			const value = exif[key] ?? (key === 'model' ? exif.cameraModel : null);
			const dataTag = spec.querySelector('data');
	
			spec.hidden = !hasExifValue(value);
			if (!spec.hidden && dataTag) {
				const displayValue = key === 'format' ? String(value).toUpperCase() : value;
				dataTag.textContent = displayValue;
				dataTag.value = value;
			} else if (!spec.hidden) {
				spec.textContent = value;
			} else if (dataTag) {
				dataTag.textContent = '';
				dataTag.value = '';
			}
		});
	
		const copyrightValue = hasExifValue(exif.copyright) ? exif.copyright : '';
		copyright.textContent = copyrightValue;
		copyright.hidden = !copyrightValue;
	}

	navigate(direction) {
		if (this.photos.length <= 1 || this.currentIndex < 0) return;
		
		this.currentIndex = (this.currentIndex + direction + this.photos.length) % this.photos.length;
		const nextTarget = this.photos[this.currentIndex];
		this.open(nextTarget);
	}

	close() {
		if (this.elements.modal.open) this.elements.modal.close();
	}

	_handleClose() {
		this.elements.image.removeAttribute('src');
		this.originalTrigger?.focus();
		this.originalTrigger = null;
	}

	_updateNavigation() {
		const canNavigate = this.photos.length > 1 && this.currentIndex >= 0;
		this.elements.previous.hidden = !canNavigate;
		this.elements.next.hidden = !canNavigate;
	}

	destroy() {
		this.abortController.abort();
		this.elements.modal?.remove();
		this.elements = {};
	}

	_getBestSource(el) {
		const img = el.querySelector('img') || el;
		
		const sourcesAttr = img.getAttribute('data-sources') || el.getAttribute('data-sources');
		if (sourcesAttr) {
			try {
				const sources = JSON.parse(sourcesAttr);
				return sources.avif || sources.webp || sources.jpg || img.src;
			} catch (error) {
				console.warn('Source parse failed', error);
			}
		}

		return el.dataset.image || img.dataset.image || img.currentSrc || img.src || el.href;
	}
}
