/**
 * Interactive photo galleries.
 */
import dataCache from '../utils/data-cache.js';
const GALLERY_CONFIG = {
	DATA_URL: '/json/gallery-data.json',
	GRID_SELECTOR: '.photo-grid',
	BUTTON_SELECTOR: '.gallery-btn',
	CONTAINER_SELECTOR: '#galleries',
	LANDSCAPE_MAX: 5,
	PORTRAIT_MAX: 6
};
export class Galleries {
	#galleries = new Map();
	#currentGallery = null;
	#galleryContainer = null;
	#controlsTemplate = null;
	#buttonTemplate = null;
	#gridTemplate = null;
	#thumbTemplate = null;
	#transitionVersion = 0;
	constructor() {
		this.#initializeDOM();
	}
	#initializeDOM() {
		this.#galleryContainer = document.querySelector(GALLERY_CONFIG.CONTAINER_SELECTOR);
		this.#controlsTemplate = document.getElementById('gallery-controls-template');
		this.#buttonTemplate = document.getElementById('gallery-button-template');
		this.#gridTemplate = document.getElementById('photo-grid-template');
		this.#thumbTemplate = document.getElementById('photo-thumb-template');
	}
	async init() {
		const requiredElements = [
			this.#galleryContainer,
			this.#controlsTemplate,
			this.#buttonTemplate,
			this.#gridTemplate,
			this.#thumbTemplate
		];
		if (requiredElements.some(element => !element)) {
			throw new Error('Gallery initialization failed: missing required template');
		}
		try {
			await this.#loadGalleries();
			this.#renderControls();
			this.applyRoute();
			delete this.#galleryContainer.dataset.state;
		}
		catch (error) {
			console.error('Gallery initialization failed:', error);
			this.#galleryContainer.dataset.state = 'error';
			throw error;
		}
	}
	async #loadGalleries() {
		const data = await dataCache.fetch(GALLERY_CONFIG.DATA_URL);
		const {
			_config,
			...galleries
		} = data;
		this.#galleries.clear();
		Object.entries(galleries)
			.forEach(([key, value]) => {
				this.#galleries.set(key, value);
			});
		const defaultKey = _config?.defaultGallery;
		const galleryKeys = Array.from(this.#galleries.keys());
		if (galleryKeys.length === 0) {
			throw new Error('Gallery data contains no galleries.');
		}
		this.#currentGallery = (defaultKey && this.#galleries.has(defaultKey)) ? defaultKey : galleryKeys[0];
		this.#loadDefaultGallery();
	}
	#renderControls() {
		const galleryKeys = Array.from(this.#galleries.keys());
		if (galleryKeys.length <= 1) return;
		const controlsFragment = this.#controlsTemplate.content.cloneNode(true);
		const controls = controlsFragment.querySelector('.gallery-controls');
		const buttonsContainer = controls.querySelector('.gallery-buttons');
		const fragment = document.createDocumentFragment();
		galleryKeys.forEach(key => {
			const gallery = this.#galleries.get(key);
			const isActive = key === this.#currentGallery;
			const buttonClone = this.#buttonTemplate.content.cloneNode(true);
			const button = buttonClone.querySelector('button');
			button.dataset.gallery = key;
			button.textContent = gallery.name || key;
			button.classList.toggle('selected', isActive);
			button.setAttribute('aria-pressed', isActive.toString());
			fragment.appendChild(buttonClone);
		});
		buttonsContainer.appendChild(fragment);
		this.#galleryContainer.querySelector('.gallery-controls')
			?.remove();
		const insertPoint = this.#galleryContainer.querySelector(GALLERY_CONFIG.GRID_SELECTOR) || this.#galleryContainer.firstElementChild;
		this.#galleryContainer.insertBefore(controlsFragment, insertPoint);
		controls.addEventListener('click', event => {
			const button = event.target.closest(GALLERY_CONFIG.BUTTON_SELECTOR);
			if (button?.dataset?.gallery) {
				if (this.#switchGallery(button.dataset.gallery)) {
					this.#galleryContainer.dispatchEvent(new CustomEvent('gallerychange', {
						bubbles: true,
						detail: {
							gallery: button.dataset.gallery
						}
					}));
				}
			}
		});
	}
	#loadDefaultGallery() {
		if (!this.#galleryContainer.querySelector(GALLERY_CONFIG.GRID_SELECTOR)) {
			const gallery = this.#galleries.get(this.#currentGallery);
			if (gallery?.images?.length) {
				this.#renderGallery(gallery, false);
			}
		}
	}
	#switchGallery(galleryKey) {
		if (!this.#galleries.has(galleryKey) || galleryKey === this.#currentGallery) {
			return false;
		}
		this.#currentGallery = galleryKey;
		this.#updateButtonStates(galleryKey);
		this.#renderGallery(this.#galleries.get(galleryKey), true);
		return true;
	}
	applyRoute({
		gallery = null,
		photo = null
	} = {}, {
		withTransition = false
	} = {}) {
		const galleryKey = gallery && this.#galleries.has(gallery) ? gallery : this.#currentGallery;
		if (galleryKey !== this.#currentGallery) {
			this.#currentGallery = galleryKey;
			this.#updateButtonStates(galleryKey);
			this.#renderGallery(this.#galleries.get(galleryKey), withTransition);
		}
		if (!photo) return;
		const trigger = this.#galleryContainer.querySelector(`.photo-thumb[data-photo-id="${CSS.escape(photo)}"]`);
		trigger?.click();
	}
	#updateButtonStates(activeKey) {
		const buttons = this.#galleryContainer.querySelectorAll(GALLERY_CONFIG.BUTTON_SELECTOR);
		buttons.forEach(btn => {
			const isActive = btn.dataset.gallery === activeKey;
			btn.classList.toggle('selected', isActive);
			btn.setAttribute('aria-pressed', isActive.toString());
		});
	}
	#renderGallery(gallery, withTransition = true) {
		if (!gallery?.images?.length) {
			this.#galleryContainer.textContent = '';
			return;
		}
		const newGridsFragment = this.#createPhotoGrids(gallery.images);
		if (withTransition) {
			this.#transitionToNewGallery(newGridsFragment);
		}
		else {
			const existingGrids = this.#galleryContainer.querySelectorAll(GALLERY_CONFIG.GRID_SELECTOR);
			existingGrids.forEach(grid => grid.remove());
			this.#galleryContainer.appendChild(newGridsFragment);
		}
	}
	#createPhotoGrids(images) {
		const fragment = document.createDocumentFragment();
		if (!images?.length) return fragment;
		const landscapeRows = this.#createBalancedRows(images, 'landscape', 'landscape-row', GALLERY_CONFIG.LANDSCAPE_MAX);
		const portraitRows = this.#createBalancedRows(images, 'portrait', 'portrait-row', GALLERY_CONFIG.PORTRAIT_MAX);
		const panoRows = this.#sortByDate(images.filter(image => image.layout === 'pano')).map(image => ({
			images: [image],
			rowClass: 'pano-row'
		}));
		this.#interleaveRows(landscapeRows, portraitRows, panoRows)
			.forEach(row => {
			if (row.images.length > 0) {
				fragment.appendChild(this.#createImageGrid(row.images, row.rowClass));
			}
		});
		return fragment;
	}
	#sortByDate(images) {
		return [...images].sort((a, b) => {
			const dateComparison = (b.dateCreated || '')
				.localeCompare(a.dateCreated || '');
			return dateComparison || (a.id || '')
				.localeCompare(b.id || '');
		});
	}
	#createBalancedRows(images, layout, rowClass, maxPerRow) {
		const sorted = this.#sortByDate(images.filter(image => image.layout === layout));
		if (sorted.length === 0) return [];
		const rowCount = Math.ceil(sorted.length / maxPerRow);
		const baseSize = Math.floor(sorted.length / rowCount);
		const extraImages = sorted.length % rowCount;
		let offset = 0;
		return Array.from({
			length: rowCount
		}, (_, index) => {
			const size = baseSize + (index < extraImages ? 1 : 0);
			const row = {
				images: sorted.slice(offset, offset + size),
				rowClass
			};
			offset += size;
			return row;
		});
	}
	#interleaveRows(landscapeRows, portraitRows, panoRows) {
		const nonPanoRows = [];
		const maxLength = Math.max(landscapeRows.length, portraitRows.length);
		for (let index = 0; index < maxLength; index++) {
			if (landscapeRows[index]) nonPanoRows.push(landscapeRows[index]);
			if (portraitRows[index]) nonPanoRows.push(portraitRows[index]);
		}
		if (panoRows.length === 0) return nonPanoRows;
		const panoSlots = Array.from({
				length: nonPanoRows.length + 1
			},
			() => []);
		panoRows.forEach((row, index) => {
			const slot = Math.floor(
				((index + 1) * nonPanoRows.length) / (panoRows.length + 1));
			panoSlots[slot].push(row);
		});
		const result = [];
		for (let index = 0; index <= nonPanoRows.length; index++) {
			result.push(...panoSlots[index]);
			if (index < nonPanoRows.length) result.push(nonPanoRows[index]);
		}
		return result;
	}
	#createImageGrid(images, rowClass) {
		const gridFragment = this.#gridTemplate.content.cloneNode(true);
		const row = gridFragment.querySelector(GALLERY_CONFIG.GRID_SELECTOR);
		row.classList.add(rowClass);
		const fragment = document.createDocumentFragment();
		images.forEach(image => {
			if (!image?.sources || !Object.keys(image.sources)
				.length) {
				console.warn('Invalid image skipped:', image);
				return;
			}
			const thumbClone = this.#thumbTemplate.content.cloneNode(true);
			const img = thumbClone.querySelector('img');
			const source = Object.values(image.sources)[0];
			img.src = image.thumbnail || '';
			img.alt = image.alt || 'Untitled';
			img.setAttribute('data-sources', JSON.stringify(image.sources));
			img.setAttribute('data-title', image.title || image.alt || 'Untitled');
			if (image.id) img.setAttribute('data-filename', image.id);
			if (image.id) {
				const trigger = thumbClone.querySelector('.photo-thumb');
				trigger.dataset.photoId = image.id;
				trigger.dataset.gallery = this.#currentGallery;
			}
			thumbClone.querySelector('.photo-content-url')
				.href = source;
			thumbClone.querySelector('.photo-name')
				.content = image.title || image.alt || 'Untitled';
			thumbClone.querySelector('.photo-description')
				.content = image.alt || image.title || 'Untitled';
			const dateCreated = thumbClone.querySelector('.photo-date-created');
			if (image.dateCreated) {
				dateCreated.content = image.dateCreated;
			}
			else {
				dateCreated.remove();
			}
			const copyrightNotice = thumbClone.querySelector('.photo-copyright-notice');
			if (image.copyrightNotice) {
				copyrightNotice.content = image.copyrightNotice;
			}
			else {
				copyrightNotice.remove();
			}
			fragment.appendChild(thumbClone);
		});
		row.appendChild(fragment);
		return gridFragment;
	}
	async #transitionToNewGallery(newContentFragment) {
		const transitionVersion = ++this.#transitionVersion;
		const existingGrids = Array.from(this.#galleryContainer.querySelectorAll(GALLERY_CONFIG.GRID_SELECTOR));
		const newGrids = Array.from(newContentFragment.children);
		const shouldSkipAnimation = window.matchMedia('(prefers-reduced-motion: reduce)')
			.matches || typeof Element.prototype.animate !== 'function';
		if (shouldSkipAnimation) {
			existingGrids.forEach(grid => grid.remove());
			this.#galleryContainer.appendChild(newContentFragment);
			return;
		}
		await this.#animateElements(existingGrids,
			[{
				opacity: 1
			}, {
				opacity: 0
			}], {
				duration: 200,
				easing: 'ease-in'
			});
		if (transitionVersion !== this.#transitionVersion) return;
		existingGrids.forEach(grid => grid.remove());
		this.#galleryContainer.appendChild(newContentFragment);
		const thumbnails = newGrids.flatMap(grid => Array.from(grid.querySelectorAll('.photo-thumb')));
		await this.#animateElements(thumbnails,
			[{
				opacity: 0,
				transform: 'translateY(0.625rem)'
			}, {
				opacity: 1,
				transform: 'translateY(0)'
			}], {
				duration: 300,
				easing: 'ease-out',
				stagger: 40
			});
	}
	async #animateElements(elements, keyframes, options) {
		const {
			stagger = 0, ...animationOptions
		} = options;
		const animations = elements.map((element, index) => element.animate(keyframes, {
			...animationOptions,
			delay: index * stagger,
			fill: 'backwards'
		}));
		await Promise.allSettled(animations.map(animation => animation.finished));
	}
}
