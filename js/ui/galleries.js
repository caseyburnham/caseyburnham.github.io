/**
 * Interactive photo galleries.
 */
import { createPhotoGrids } from '../../shared/gallery-render.js';
import dataCache from '../utils/data-cache.js';
const GALLERY_CONFIG = {
	DATA_URL: '/json/gallery-data.json',
	GRID_SELECTOR: '.photo-grid',
	BUTTON_SELECTOR: '.gallery-btn',
	CONTAINER_SELECTOR: '#galleries'
};
export class Galleries {
	#galleries = new Map();
	#currentGallery = null;
	#galleryContainer = null;
	#gridTemplate = null;
	#thumbTemplate = null;
	#transitionVersion = 0;
	constructor() {
		this.#initializeDOM();
	}
	#initializeDOM() {
		this.#galleryContainer = document.querySelector(GALLERY_CONFIG.CONTAINER_SELECTOR);
		this.#gridTemplate = document.getElementById('photo-grid-template');
		this.#thumbTemplate = document.getElementById('photo-thumb-template');
	}
	async init() {
		const requiredElements = [
			this.#galleryContainer,
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
		const controls = this.#galleryContainer.querySelector('.gallery-controls');
		controls.querySelectorAll('button').forEach(button => { button.disabled = false; });
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
		if (photo || galleryKey !== this.#currentGallery) {
			this.#currentGallery = galleryKey;
			this.#updateButtonStates(galleryKey);
			// A photo route needs its target in the DOM before opening the viewer.
			this.#renderGallery(this.#galleries.get(galleryKey), withTransition && !photo);
		}
		if (!photo) return;
		const trigger = this.#galleryContainer.querySelector(`.photo-thumb[data-photo-id="${CSS.escape(photo)}"]`);
		trigger?.click();
	}
	#updateButtonStates(activeKey) {
		const buttons = this.#galleryContainer.querySelectorAll(GALLERY_CONFIG.BUTTON_SELECTOR);
		buttons.forEach(btn => {
			const isActive = btn.dataset.gallery === activeKey;
			btn.setAttribute('aria-pressed', isActive.toString());
		});
	}
	#renderGallery(gallery, withTransition = true) {
		if (!gallery?.images?.length) {
			this.#galleryContainer.textContent = '';
			return;
		}
		const newGridsFragment = createPhotoGrids(document, gallery.images, this.#currentGallery);
		if (withTransition) {
			this.#transitionToNewGallery(newGridsFragment);
		}
		else {
			this.#transitionVersion += 1;
			const existingGrids = this.#galleryContainer.querySelectorAll(GALLERY_CONFIG.GRID_SELECTOR);
			existingGrids.forEach(grid => grid.remove());
			this.#galleryContainer.appendChild(newGridsFragment);
		}
	}
	async #transitionToNewGallery(newContentFragment) {
		const transitionVersion = ++this.#transitionVersion;
		const existingGrids = Array.from(this.#galleryContainer.querySelectorAll(GALLERY_CONFIG.GRID_SELECTOR));
		// Outgoing thumbnails must not open after the selected gallery changes.
		existingGrids.forEach(grid => { grid.inert = true; });
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
