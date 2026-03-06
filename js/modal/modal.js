import dataCache from '../utils/shared-data.js';
import { formatExifDate, formatElevation, findExifData } from '../utils/exif-utils.js';

export class PhotoModal {
	constructor(galleryContainerSelector = '.photo-gallery') {
		this.exifData = {};
		this.elements = {};
		this.photos = [];
		this.currentIndex = -1;
		this.container = document.querySelector(galleryContainerSelector) || document.body;
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

		// Cache references using a data-attribute convention if possible, 
		// or just clean selectors.
		const q = (s) => dialog.querySelector(s);
		this.elements = {
			modal: dialog,
			closeBtn: q('.dialog-close'),
			image: q('.modal-image'),
			title: q('.photo-title'),
			date: q('.photo-date'),
			altitude: q('.altitude'),
			gps: q('.gps'),
			camera: q('.exif-data'),
			copyright: q('.copyright')
		};

		this.elements.closeBtn?.addEventListener('click', () => this.close());
		this.elements.modal.addEventListener('close', () => this._handleClose());
		
	}

	_setupEventListeners() {
		this.container.addEventListener('click', (e) => {
			const trigger = e.target.closest('.photo-thumb, .camera-link');
			if (!trigger) return;

			e.preventDefault();
			this.open(trigger);
		});

		this.elements.modal.addEventListener('click', (e) => {
			if (e.target === this.elements.modal) {
				this.close();
			}
		});
		
		this.elements.modal.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') this.navigate(1);
			if (e.key === 'ArrowLeft') this.navigate(-1);
		});
	}

	/**
	 * @param {HTMLElement}
	 */
	open(trigger) {
		const img = trigger.querySelector('img') || trigger;
		const src = this._getBestSource(trigger);
		const title = trigger.dataset.title || img.dataset?.title || 'Untitled';

		this.photos = Array.from(this.container.querySelectorAll('.photo-thumb'));
		this.currentIndex = this.photos.indexOf(trigger.closest('.photo-thumb'));

		this._render(src, img.alt, title);
		
		if (!this.elements.modal.open) {
			this.originalTrigger = trigger;
			this.elements.modal.showModal();
			window.scrollTo({ top: scrollY, behavior: 'instant' });
			this.elements.modal.focus({ preventScroll: true });
		}
	}

	_render(src, alt, title) {
		const { image, title: titleEl } = this.elements;

		image.src = src;
		image.alt = alt || title;
		titleEl.textContent = title;

		this._renderMetadata(src, title);
	}

	_renderMetadata(src, title) {
		const exif = findExifData(src, this.exifData);
		const { modal, copyright } = this.elements;
	
		if (!exif) {
			modal.querySelector('.photo-metadata').hidden = true;
			return;
		}
		modal.querySelector('.photo-metadata').hidden = false;

		const dateEl = modal.querySelector('.photo-date');
		const dateStr = formatExifDate(exif.date);
		dateEl.textContent = dateStr;
		dateEl.setAttribute('datetime', dateStr);
	
		const altEl = modal.querySelector('.altitude');
		if (exif.gps?.alt) {
			const { display, value } = formatElevation(exif.gps.alt);
			altEl.textContent = display;
			altEl.value = value;
		} else {
			altEl.parentElement.hidden = true;
			altEl.parentElement.previousElementSibling.hidden = true;
		}
		const gpsRow = modal.querySelector('[data-gps-row]');
		const gpsLabel = modal.querySelector('[data-gps-label]');
		
		if (exif.gps?.lat && exif.gps?.lon) {
			const { lat, lon, latDMS, lonDMS } = exif.gps;
			const dataTag = gpsRow.querySelector('.gps-data');
			const anchor = gpsRow.querySelector('.gps-link');
			const coords = `${lat}, ${lon}`;
			
			dataTag.title = coords;
			dataTag.value = coords;
			dataTag.textContent = latDMS ? `${latDMS}, ${lonDMS}` : coords;
			
			anchor.href = `https://caltopo.com/map.html#ll=${lat},${lon}&z=16&b=mbt`;
			
			gpsRow.hidden = false;
			gpsLabel.hidden = false;
		} else {
			gpsRow.hidden = true;
			gpsLabel.hidden = true;
		}
	
		const specs = modal.querySelectorAll('[data-spec]');
		specs.forEach(spec => {
			const key = spec.dataset.spec;
			const val = exif[key] || (key === 'model' ? exif.cameraModel : null);
			const dataTag = spec.querySelector('data');
	
			if (val) {
				spec.hidden = false;
				if (dataTag) {
					dataTag.textContent = val;
					dataTag.value = val;
				} else {
					spec.textContent = key === 'format' ? val.toUpperCase() : val;
				}
			} else {
				spec.hidden = true;
			}
		});
	
		copyright.textContent = exif.copyright || '';
		copyright.hidden = !exif.copyright;
	}

	navigate(direction) {
		if (this.photos.length <= 1) return;
		
		this.currentIndex = (this.currentIndex + direction + this.photos.length) % this.photos.length;
		const nextTarget = this.photos[this.currentIndex];
		this.open(nextTarget);
	}

	close() {
		this.elements.modal.close();
	}

	_handleClose() {
		this.elements.image.src = '';
		this.originalTrigger?.focus();
	}

	_getBestSource(el) {
		const img = el.querySelector('img') || el;
		
		const sourcesAttr = img.getAttribute('data-sources') || el.getAttribute('data-sources');
		if (sourcesAttr) {
			try {
				const sources = JSON.parse(sourcesAttr);
				return sources.avif || sources.webp || sources.jpg || img.src;
			} catch (e) {
				console.warn("Source parse failed", e);
			}
		}

		return el.dataset.image || img.dataset.image || img.src || el.href;
	}
}