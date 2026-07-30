import dataCache from '../utils/shared-data.js';
import {
	formatExifDate,
	formatElevation,
	findExifData
}
from '../utils/exif-utils.js';
const hasExifValue = value => value != null && String(value)
	.trim() !== '' && String(value)
	.trim()
	.toLowerCase() !== 'unknown';
export class PhotoModal {
	constructor(triggerContainer = document) {
		this.exifData = {};
		this.elements = {};
		this.photos = [];
		this.currentIndex = -1;
		this.renderToken = 0;
		this.loadingTimer = null;
		this.transitionTimer = null;
		this.closeCleanupTimer = null;
		this.swipeStart = null;
		this.wheelDelta = 0;
		this.wheelGestureLocked = false;
		this.wheelEndTimer = null;
		this.wheelLastMagnitude = 0;
		this.wheelLastDirection = 0;
		this.wheelLastEventTime = 0;
		this.wheelNavigationTime = 0;
		this.container = triggerContainer;
		this.abortController = new AbortController();
	}
	async initialize() {
		this._createModal();
		this._setupEventListeners();
		this.exifData = await dataCache.fetch('/json/exif-data.json')
			.catch(() => ({}));
	}
	_createModal() {
		const template = document.getElementById('photo-modal-template');
		if (!template) throw new Error('Modal template missing.');
		const fragment = template.content.cloneNode(true);
		const dialog = fragment.querySelector('dialog');
		document.body.appendChild(dialog);
		const query = selector => dialog.querySelector(selector);
		const images = [...dialog.querySelectorAll('.modal-image')];
		this.elements = {
			modal: dialog,
			content: query('.modal-content'),
			media: query('.modal-media'),
			images,
			loading: query('.modal-loading'),
			loadingMessage: query('.modal-loading-message'),
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
		[this.activeImage, this.standbyImage] = images;
	}
	_setupEventListeners() {
		const {
			signal
		} = this.abortController;
		this.container.addEventListener('click', (e) => {
			const trigger = e.target.closest('.photo-thumb, .camera-link');
			if (!trigger) return;
			e.preventDefault();
			this.open(trigger);
		}, {
			signal
		});
		this.elements.modal.addEventListener('click', (e) => {
			if (e.target === this.elements.modal) {
				this.close();
			}
		}, {
			signal
		});
		this.elements.modal.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				this.navigate(1);
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				this.navigate(-1);
			}
		}, {
			signal
		});
		this.elements.previous.addEventListener('click', () => this.navigate(-1), {
			signal
		});
		this.elements.next.addEventListener('click', () => this.navigate(1), {
			signal
		});
		this.elements.modal.addEventListener('close', () => this._handleClose(), {
			signal
		});
		this.elements.media.addEventListener('pointerdown', (e) => this._startSwipe(e), {
			signal
		});
		this.elements.media.addEventListener('pointerup', (e) => this._finishSwipe(e), {
			signal
		});
		this.elements.media.addEventListener('pointercancel', () => this._cancelSwipe(), {
			signal
		});
		document.addEventListener('wheel', (e) => this._handleWheel(e), {
			passive: false,
			signal
		});
	}
	/**
	 * @param {HTMLElement}
	 */
	open(trigger) {
		const img = trigger.querySelector('img') || trigger;
		const src = this._getBestSource(trigger);
		const title = trigger.dataset.title || img.dataset?.title || 'Untitled';
		if (!src) return;
		const isOpening = !this.elements.modal.open;
		if (isOpening) {
			clearTimeout(this.closeCleanupTimer);
			this._clearImages();
			this.originalTrigger = trigger;
		}
		const itemSelector = trigger.matches('.camera-link') ? '.camera-link' : '.photo-thumb';
		this.photos = Array.from(this.container.querySelectorAll(itemSelector));
		this.currentIndex = this.photos.indexOf(trigger.closest(itemSelector));
		this._render(src, img.alt, title);
		this._updateNavigation();
		if (isOpening) {
			this.elements.modal.showModal();
		}
	}
	async _render(src, alt, title) {
		this._finishImageTransition();
		const token = ++this.renderToken;
		this._setImageLoading();
		const preload = new Image();
		preload.decoding = 'async';
		preload.src = src;
		try {
			if (!preload.complete) {
				await new Promise((resolve, reject) => {
					preload.addEventListener('load', resolve, {
						once: true
					});
					preload.addEventListener('error', reject, {
						once: true
					});
				});
			}
			if (!preload.naturalWidth) throw new Error('Image failed to load.');
			await preload.decode()
				.catch(() => {});
		}
		catch {
			if (token === this.renderToken) this._finishImageLoad(true);
			return;
		}
		if (token !== this.renderToken) return;
		this._showImage(preload, src, alt || title, title, token);
	}
	_setImageLoading() {
		const {
			content,
			loading,
			loadingMessage
		} = this.elements;
		content.classList.add('is-loading');
		content.removeAttribute('data-load-error');
		content.setAttribute('aria-busy', 'true');
		loading.hidden = true;
		loadingMessage.textContent = 'Loading photo…';
		clearTimeout(this.loadingTimer);
		if (!this.activeImage.getAttribute('src')) {
			loading.hidden = false;
			return;
		}
		this.loadingTimer = setTimeout(() => {
			loading.hidden = false;
		}, 200);
	}
	_finishImageLoad(hasError = false) {
		const {
			content,
			loading,
			loadingMessage
		} = this.elements;
		clearTimeout(this.loadingTimer);
		content.classList.remove('is-loading');
		content.removeAttribute('aria-busy');
		content.toggleAttribute('data-load-error', hasError);
		if (hasError) {
			loading.hidden = false;
			loadingMessage.textContent = 'This photo could not be loaded.';
			return;
		}
		loading.hidden = true;
	}
	async _showImage(preload, src, alt, title, token) {
		const {
			content,
			media,
			title: titleEl
		} = this.elements;
		const incoming = this.standbyImage;
		const outgoing = this.activeImage;
		const {
			inlineSize,
			blockSize
		} = this._getRenderedImageSize(preload);
		this._finishImageLoad();
		content.classList.add('is-transitioning');
		incoming.src = src;
		incoming.alt = alt;
		incoming.setAttribute('aria-hidden', 'true');
		incoming.classList.remove('is-active', 'is-incoming', 'is-leaving');
		media.style.setProperty('--modal-media-inline-size', `${inlineSize}px`);
		media.style.setProperty('--modal-media-block-size', `${blockSize}px`);
		titleEl.textContent = title;
		this._renderMetadata(src);
		await new Promise(resolve => requestAnimationFrame(resolve));
		if (token !== this.renderToken) return;
		outgoing.setAttribute('aria-hidden', 'true');
		incoming.removeAttribute('aria-hidden');
		outgoing.classList.add('is-leaving');
		incoming.classList.add('is-incoming');
			this.transitionTimer = setTimeout(() => {
				if (token === this.renderToken) this._finishImageTransition();
			}, 220);
	}
	_finishImageTransition() {
		const incoming = this.standbyImage;
		if (!incoming?.getAttribute('src') || !this.elements.content.classList.contains('is-transitioning')) return;
		clearTimeout(this.transitionTimer);
		const outgoing = this.activeImage;
		outgoing.classList.remove('is-active', 'is-leaving');
		outgoing.setAttribute('aria-hidden', 'true');
		outgoing.removeAttribute('src');
		outgoing.alt = '';
		incoming.classList.remove('is-incoming');
		incoming.classList.add('is-active');
		incoming.removeAttribute('aria-hidden');
		this.activeImage = incoming;
		this.standbyImage = outgoing;
		this.elements.content.classList.remove('is-transitioning');
	}
	_getRenderedImageSize(image) {
		const compact = matchMedia('(hover: none), (max-width: 48rem)')
			.matches;
		const maxInlineSize = compact ? window.innerWidth - 16 : window.innerWidth * 0.85;
		const maxBlockSize = window.innerHeight * (compact ? 0.7 : 0.9);
		const scale = Math.min(1, maxInlineSize / image.naturalWidth, maxBlockSize / image.naturalHeight);
		return {
			inlineSize: Math.round(image.naturalWidth * scale),
			blockSize: Math.round(image.naturalHeight * scale)
		};
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
		const hasAltitude = hasExifValue(altitudeValue) && Number.isFinite(Number(altitudeValue));
		altitude.parentElement.hidden = !hasAltitude;
		if (hasAltitude) {
			const {
				display,
				feetRaw
			} = formatElevation(altitudeValue);
			altitude.textContent = display;
			altitude.value = feetRaw;
		}
		else {
			altitude.textContent = '';
			altitude.value = '';
		}
		const latitude = exif.gps?.lat;
		const longitude = exif.gps?.lon;
		const hasCoordinates = hasExifValue(latitude) && hasExifValue(longitude) && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
		if (hasCoordinates) {
			const {
				lat,
				lon,
				latDMS,
				lonDMS
			} = exif.gps;
			const coords = `${lat}, ${lon}`;
			gpsData.title = coords;
			gpsData.value = coords;
			gpsData.textContent = latDMS && lonDMS ? `${latDMS}, ${lonDMS}` : coords;
			gpsLink.href = `https://caltopo.com/map.html#ll=${lat},${lon}&z=16&b=mbt`;
			gpsRow.hidden = false;
			gpsLabel.hidden = false;
		}
		else {
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
				const displayValue = key === 'format' ? String(value)
					.toUpperCase() : value;
				dataTag.textContent = displayValue;
				dataTag.value = value;
			}
			else if (!spec.hidden) {
				spec.textContent = value;
			}
			else if (dataTag) {
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
	_startSwipe(event) {
		if (event.pointerType === 'mouse') return;
		this.swipeStart = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY
		};
	}
	_finishSwipe(event) {
		if (!this.swipeStart || event.pointerId !== this.swipeStart.pointerId) return;
		const deltaX = event.clientX - this.swipeStart.x;
		const deltaY = event.clientY - this.swipeStart.y;
		const threshold = Math.max(48, this.elements.media.clientWidth * 0.12);
		this.swipeStart = null;
		if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
		this.navigate(deltaX < 0 ? 1 : -1);
	}
	_cancelSwipe() {
		this.swipeStart = null;
	}
	_handleWheel(event) {
		if (!this.elements.modal.open || this.photos.length <= 1 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
		event.preventDefault();
		const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerWidth : 1;
		const delta = event.deltaX * multiplier;
		const direction = Math.sign(delta);
		const magnitude = Math.abs(delta);
		const now = performance.now();
		const eventGap = now - this.wheelLastEventTime;
		clearTimeout(this.wheelEndTimer);
		this.wheelEndTimer = setTimeout(() => {
			this.wheelDelta = 0;
			this.wheelGestureLocked = false;
			this.wheelLastMagnitude = 0;
			this.wheelLastDirection = 0;
		}, 140);
		if (this.wheelGestureLocked) {
			const directionChanged = direction !== this.wheelLastDirection;
			const renewedAcceleration = now - this.wheelNavigationTime > 150 && magnitude >= 12 && magnitude > this.wheelLastMagnitude * 1.5;
			if (!directionChanged && eventGap <= 140 && !renewedAcceleration) {
				this.wheelLastMagnitude = magnitude;
				this.wheelLastEventTime = now;
				return;
			}
			this.wheelGestureLocked = false;
			this.wheelDelta = 0;
		}
		this.wheelLastMagnitude = magnitude;
		this.wheelLastDirection = direction;
		this.wheelLastEventTime = now;
		this.wheelDelta += delta;
		if (Math.abs(this.wheelDelta) < 60) return;
		this.wheelGestureLocked = true;
		this.wheelNavigationTime = now;
		this.navigate(this.wheelDelta > 0 ? 1 : -1);
		this.wheelDelta = 0;
	}
	close() {
		if (this.elements.modal.open) this.elements.modal.close();
	}
	_handleClose() {
		this.renderToken += 1;
		clearTimeout(this.loadingTimer);
		clearTimeout(this.wheelEndTimer);
		this._finishImageTransition();
		this.swipeStart = null;
		this.wheelDelta = 0;
		this.wheelGestureLocked = false;
		this.wheelLastMagnitude = 0;
		this.wheelLastDirection = 0;
		this.wheelLastEventTime = 0;
		this.wheelNavigationTime = 0;
		this.elements.loading.hidden = true;
		this.elements.content.classList.remove('is-loading');
		this.elements.content.removeAttribute('aria-busy');
		this.elements.content.removeAttribute('data-load-error');
		clearTimeout(this.closeCleanupTimer);
		this.closeCleanupTimer = setTimeout(() => {
			if (!this.elements.modal.open) this._clearImages();
		}, 320);
		this.originalTrigger?.focus();
		this.originalTrigger = null;
	}
	_clearImages() {
		clearTimeout(this.closeCleanupTimer);
		this.closeCleanupTimer = null;
		this.elements.images.forEach((image) => {
			image.removeAttribute('src');
			image.alt = '';
			image.classList.remove('is-incoming', 'is-leaving');
			image.toggleAttribute('aria-hidden', image !== this.activeImage);
		});
		this.activeImage.classList.add('is-active');
		this.standbyImage.classList.remove('is-active');
		this.elements.media.style.removeProperty('--modal-media-inline-size');
		this.elements.media.style.removeProperty('--modal-media-block-size');
		this.elements.title.textContent = '';
		this.elements.metadata.hidden = true;
		this.elements.copyright.hidden = true;
	}
	_updateNavigation() {
		const canNavigate = this.photos.length > 1 && this.currentIndex >= 0;
		this.elements.previous.hidden = !canNavigate;
		this.elements.next.hidden = !canNavigate;
	}
	destroy() {
		this.abortController.abort();
		clearTimeout(this.loadingTimer);
		clearTimeout(this.transitionTimer);
		clearTimeout(this.wheelEndTimer);
		clearTimeout(this.closeCleanupTimer);
		this.elements.modal?.remove();
		this.elements = {};
	}
	_getBestSource(el) {
		const img = el.querySelector('img') || el;
		const sourcesAttr = img.getAttribute('data-sources') || el.getAttribute('data-sources');
		if (sourcesAttr) {
			try {
				const sources = JSON.parse(sourcesAttr);
				return (sources.avif || sources.webp || sources.jpeg || sources.jpg || sources.png || img.src);
			}
			catch (error) {
				console.warn('Source parse failed', error);
			}
		}
		return el.dataset.image || img.dataset.image || img.currentSrc || img.src || el.href;
	}
}
