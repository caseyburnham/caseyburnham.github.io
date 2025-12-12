/**
 * Galleries - Simplified (Actually simplified this time)
 */
import { debounce } from '../utils/shared-utils.js';

class Galleries {
	static CONFIG = {
		DATA_URL: '/json/gallery-data.json',
		GRID_SELECTOR: '.photo-grid',
		BUTTON_SELECTOR: '.gallery-btn',
		CONTAINER_SELECTOR: '[aria-labelledby="gallery-heading"]',
		TRANSITION_DURATION: 400,
		
		// Simple row limits
		LANDSCAPE_MAX: 5,
		PORTRAIT_MAX: 6,
		MIN_IMAGES: 3
	};

	#galleries = new Map();
	#currentGallery = null;
	#isInitialized = false;
	#photoModal = null;
	#galleryContainer = null;
	#buttonTemplate = null;
	#thumbTemplate = null;
	#resizeHandler = null;
	#clickHandler = null;
	
	constructor(options = {}) {
		this.#photoModal = options.photoModal || null;
		this.#initializeDOM();
		this.#setupResponsiveHandler();
		this.init();
	}

	destroy() {
		// Clean up event listeners
		if (this.#resizeHandler) {
			window.removeEventListener('resize', this.#resizeHandler);
		}
		if (this.#clickHandler) {
			const controls = this.#galleryContainer?.querySelector('.gallery-controls');
			controls?.removeEventListener('click', this.#clickHandler);
		}
		
		this.#galleries.clear();
		this.#currentGallery = null;
		this.#isInitialized = false;
	}

	#initializeDOM() {
		this.#galleryContainer = document.querySelector(Galleries.CONFIG.CONTAINER_SELECTOR);
		this.#buttonTemplate = document.getElementById('gallery-button-template');
		this.#thumbTemplate = document.getElementById('photo-thumb-template');
	}

	#setupResponsiveHandler() {
		let lastWidth = window.innerWidth;
		
		this.#resizeHandler = debounce(() => {
			const currentWidth = window.innerWidth;
			
			// Only re-render if width actually changed (ignore mobile address bar)
			if (currentWidth !== lastWidth && this.#isInitialized && this.#currentGallery) {
				lastWidth = currentWidth;
				const gallery = this.#galleries.get(this.#currentGallery);
				if (gallery) this.#renderGallery(gallery, false);
			}
		}, 250);
	
		window.addEventListener('resize', this.#resizeHandler);
	}

	async init() {
		if (!this.#galleryContainer || !this.#buttonTemplate || !this.#thumbTemplate) {
			console.error('Gallery initialization failed: missing elements');
			this.#createFallbackGallery();
			return;
		}

		try {
			await this.#loadGalleries();
			this.#renderControls();
			this.#isInitialized = true;
		} catch (error) {
			console.error('Gallery initialization failed:', error);
			this.#createFallbackGallery();
		}
	}

	async #loadGalleries() {
		const response = await fetch(Galleries.CONFIG.DATA_URL);
		if (!response.ok) {
			throw new Error(`Failed to load galleries: ${response.status}`);
		}

		const data = await response.json();
		const { _config, ...galleries } = data;
		
		this.#galleries.clear();
		Object.entries(galleries).forEach(([key, value]) => {
			this.#galleries.set(key, value);
		});

		const defaultKey = _config?.defaultGallery;
		const galleryKeys = Array.from(this.#galleries.keys());
		this.#currentGallery = (defaultKey && this.#galleries.has(defaultKey)) 
			? defaultKey 
			: galleryKeys[0];
		
		this.#loadDefaultGallery();
	}

	#createFallbackGallery() {
		const images = Array.from(document.querySelectorAll('.photo-thumb img'))
			.filter(img => img.src)
			.map(img => ({
				id: img.dataset.filename || `img-${crypto.randomUUID()}`,
				sources: { avif: img.src },
				thumbnail: img.src,
				alt: img.alt || 'Untitled',
				title: img.dataset.title || img.alt || 'Untitled',
				layout: 'landscape',
			}));
		
		this.#galleries.set('fallback', { name: 'Photo Gallery', images });
		this.#currentGallery = 'fallback';
		this.#renderControls();
		this.#renderGallery(this.#galleries.get('fallback'));
	}

	#renderControls() {
		const galleryKeys = Array.from(this.#galleries.keys());
		if (galleryKeys.length <= 1) return;

		const controls = document.createElement('div');
		controls.className = 'gallery-controls';
		
		const buttonsContainer = document.createElement('div');
		buttonsContainer.className = 'gallery-buttons';
		buttonsContainer.role = 'tablist';
		buttonsContainer.setAttribute('aria-label', 'Photo galleries');

		const fragment = document.createDocumentFragment();

		galleryKeys.forEach(key => {
			const gallery = this.#galleries.get(key);
			const isActive = key === this.#currentGallery;
			
			const buttonClone = this.#buttonTemplate.content.cloneNode(true);
			const button = buttonClone.querySelector('button');
			
			button.dataset.gallery = key;
			button.textContent = gallery.name || key;
			button.classList.toggle('active', isActive);
			button.setAttribute('aria-selected', isActive.toString());
			
			fragment.appendChild(buttonClone);
		});

		buttonsContainer.appendChild(fragment);
		controls.appendChild(buttonsContainer);

		this.#galleryContainer.querySelector('.gallery-controls')?.remove();
		
		const insertPoint = this.#galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR) 
			|| this.#galleryContainer.firstElementChild;
		this.#galleryContainer.insertBefore(controls, insertPoint);

		this.#clickHandler = (e) => {
			const button = e.target.closest(Galleries.CONFIG.BUTTON_SELECTOR);
			if (button?.dataset?.gallery) {
				this.switchGallery(button.dataset.gallery);
			}
		};
		
		controls.addEventListener('click', this.#clickHandler);
	}

	#loadDefaultGallery() {
		if (!this.#galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR)) {
			const gallery = this.#galleries.get(this.#currentGallery);
			if (gallery?.images?.length) {
				this.#renderGallery(gallery, false);
			}
		}
	}

	switchGallery(galleryKey) {
		if (!this.#galleries.has(galleryKey) || galleryKey === this.#currentGallery) {
			return false;
		}

		this.#currentGallery = galleryKey;
		this.#updateButtonStates(galleryKey);
		this.#renderGallery(this.#galleries.get(galleryKey), true);
		return true;
	}

	#updateButtonStates(activeKey) {
		const buttons = this.#galleryContainer.querySelectorAll(Galleries.CONFIG.BUTTON_SELECTOR);
		buttons.forEach(btn => {
			const isActive = btn.dataset.gallery === activeKey;
			btn.classList.toggle('active', isActive);
			btn.setAttribute('aria-selected', isActive.toString());
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
		} else {
			const existingGrids = this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR);
			existingGrids.forEach(grid => grid.remove());
			this.#galleryContainer.appendChild(newGridsFragment);
			this.#photoModal?.refreshImageTracking?.();
		}
	}

	#createPhotoGrids(images) {
		const fragment = document.createDocumentFragment();
		if (!images?.length) return fragment;

		const { LANDSCAPE_MAX, PORTRAIT_MAX, MIN_IMAGES } = Galleries.CONFIG;

		// Group by layout
		const groups = {
			landscape: images.filter(img => img.layout === 'landscape'),
			portrait: images.filter(img => img.layout === 'portrait'),
			pano: images.filter(img => img.layout === 'pano')
		};

		// Create rows for each type
		const landscapeRows = this.#createRows(groups.landscape, 'landscape-row', LANDSCAPE_MAX, MIN_IMAGES);
		const portraitRows = this.#createRows(groups.portrait, 'portrait-row', PORTRAIT_MAX, MIN_IMAGES);
		const panoRows = groups.pano.map(img => ({ images: [img], rowClass: 'pano-row' }));

		// Interleave with better pano distribution
		const rows = this.#interleaveRows(landscapeRows, portraitRows, panoRows);

		// Create DOM elements
		rows.forEach(row => {
			if (row.images.length > 0) {
				fragment.appendChild(this.#createImageGrid(row.images, row.rowClass));
			}
		});

		return fragment;
	}

	#createRows(images, rowClass, maxPerRow, minImages) {
		if (!images?.length) return [];
		
		// If fewer than minimum, return single row
		if (images.length < minImages) {
			return [{ images: [...images], rowClass }];
		}

		const rows = [];
		let i = 0;

		while (i < images.length) {
			const remaining = images.length - i;
			
			// Calculate row size
			let rowSize;
			if (remaining <= maxPerRow) {
				// Last row - take all remaining
				rowSize = remaining;
			} else if (remaining <= maxPerRow + minImages) {
				// Would leave too few in next row - split evenly
				rowSize = Math.ceil(remaining / 2);
			} else {
				// Normal case - take max
				rowSize = maxPerRow;
			}

			rows.push({
				images: images.slice(i, i + rowSize),
				rowClass
			});
			i += rowSize;
		}

		return rows;
	}

	#interleaveRows(landscapeRows, portraitRows, panoRows) {
		const result = [];
		
		// Calculate total non-pano rows
		const totalNonPanoRows = landscapeRows.length + portraitRows.length;
		
		// If no panos, just alternate landscape/portrait
		if (panoRows.length === 0) {
			const maxLength = Math.max(landscapeRows.length, portraitRows.length);
			for (let i = 0; i < maxLength; i++) {
				if (i < landscapeRows.length) result.push(landscapeRows[i]);
				if (i < portraitRows.length) result.push(portraitRows[i]);
			}
			return result;
		}
		
		// Calculate spacing for panos (distribute evenly)
		const panoInterval = Math.floor(totalNonPanoRows / (panoRows.length + 1));
		
		let landscapeIndex = 0;
		let portraitIndex = 0;
		let panoIndex = 0;
		let rowCount = 0;
		let nextPanoAt = panoInterval;
		
		// Interleave all rows
		while (landscapeIndex < landscapeRows.length || portraitIndex < portraitRows.length || panoIndex < panoRows.length) {
			// Check if it's time for a pano
			if (panoIndex < panoRows.length && rowCount === nextPanoAt) {
				result.push(panoRows[panoIndex++]);
				nextPanoAt = rowCount + panoInterval;
				continue; // Don't increment rowCount for panos
			}
			
			// Alternate between landscape and portrait
			if (landscapeIndex < landscapeRows.length) {
				result.push(landscapeRows[landscapeIndex++]);
				rowCount++;
			}
			
			// Check again for pano after landscape
			if (panoIndex < panoRows.length && rowCount === nextPanoAt) {
				result.push(panoRows[panoIndex++]);
				nextPanoAt = rowCount + panoInterval;
				continue;
			}
			
			if (portraitIndex < portraitRows.length) {
				result.push(portraitRows[portraitIndex++]);
				rowCount++;
			}
		}
		
		return result;
	}

	#createImageGrid(images, rowClass) {
		const row = document.createElement('div');
		row.className = `photo-grid grid ${rowClass}`;
		row.setAttribute('role', 'group');

		const fragment = document.createDocumentFragment();

		images.forEach(image => {
			if (!image?.sources || !Object.keys(image.sources).length) {
				console.warn('Invalid image skipped:', image);
				return;
			}

			const thumbClone = this.#thumbTemplate.content.cloneNode(true);
			const img = thumbClone.querySelector('img');
			
			img.src = image.thumbnail || '';
			img.alt = image.alt || 'Untitled';
			img.setAttribute('data-sources', JSON.stringify(image.sources));
			img.setAttribute('data-title', image.title || image.alt || 'Untitled');
			if (image.id) img.setAttribute('data-filename', image.id);
			
			fragment.appendChild(thumbClone);
		});

		row.appendChild(fragment);
		return row;
	}

	async #transitionToNewGallery(newContentFragment) {
		const existingGrids = Array.from(
			this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR)
		);
	
		// Lock the container height before removing content
		const currentHeight = this.#galleryContainer.offsetHeight;
		this.#galleryContainer.style.minHeight = `${currentHeight}px`;
	
		// Fade out existing
		await Promise.all(existingGrids.map(grid => this.#fadeOut(grid)));
		existingGrids.forEach(grid => grid.remove());
	
		// Fade in new
		const newGrids = Array.from(newContentFragment.children);
		newGrids.forEach(grid => { grid.style.opacity = '0'; });
		this.#galleryContainer.appendChild(newContentFragment);
	
		await Promise.all(
			newGrids.map((grid, index) => this.#fadeIn(grid, index * 100))
		);
	
		// Release the height lock
		this.#galleryContainer.style.minHeight = '';
	
		this.#photoModal?.refreshImageTracking?.();
	}

	#fadeOut(element) {
		return new Promise(resolve => {
			element.style.transition = `opacity ${Galleries.CONFIG.TRANSITION_DURATION}ms ease`;
			element.style.opacity = '0';
			
			const timeout = setTimeout(resolve, Galleries.CONFIG.TRANSITION_DURATION);
			element.addEventListener('transitionend', () => {
				clearTimeout(timeout);
				resolve();
			}, { once: true });
		});
	}

	#fadeIn(element, delay = 0) {
		return new Promise(resolve => {
			setTimeout(() => {
				element.style.transition = `opacity ${Galleries.CONFIG.TRANSITION_DURATION}ms ease`;
				element.style.opacity = '1';
				
				const timeout = setTimeout(resolve, Galleries.CONFIG.TRANSITION_DURATION + 100);
				element.addEventListener('transitionend', () => {
					clearTimeout(timeout);
					resolve();
				}, { once: true });
			}, delay);
		});
	}
}

// Initialize
function initializeGalleries() {
	try {
		window.Galleries?.destroy?.();
		window.Galleries = new Galleries({
			photoModal: window.photoModal
		});
	} catch (error) {
		console.error('Galleries initialization failed:', error);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeGalleries);
} else {
	initializeGalleries();
}

window.addEventListener('beforeunload', () => {
	window.Galleries?.destroy();
});