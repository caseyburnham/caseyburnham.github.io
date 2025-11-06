/**
 * Galleries
 **/
import { debounce } from './shared-utils.js';
 
class Galleries {
	static CONFIG = {
		DATA_URL: '/json/gallery-data.json',
		CONTROLS_SELECTOR: '.gallery-controls',
		GRID_SELECTOR: '.photo-grid',
		BUTTON_SELECTOR: '.gallery-btn',
		CONTAINER_SELECTOR: '[aria-labelledby="gallery-heading"]',
		TRANSITION_DURATION: 200,
		
		BREAKPOINTS: {
			MOBILE: 480,
			TABLET: 768,
			DESKTOP: 1024,
			WIDESCREEN: 1440
		},
		
		ROW_LIMITS_BY_BREAKPOINT: {
			MOBILE: { LANDSCAPE_MAX: 3, PORTRAIT_MAX: 4, MIN_IMAGES: 3 },
			TABLET: { LANDSCAPE_MAX: 4, PORTRAIT_MAX: 5, MIN_IMAGES: 3 },
			DESKTOP: { LANDSCAPE_MAX: 5, PORTRAIT_MAX: 6, MIN_IMAGES: 3 },
			WIDESCREEN: { LANDSCAPE_MAX: 5, PORTRAIT_MAX: 7, MIN_IMAGES: 3 }
		}
	};

	#galleries = new Map();
	#currentGallery = null;
	#isInitialized = false;
	#photoModal = null;
	#galleryContainer = null;
	#buttonTemplate = null;
	#thumbTemplate = null;
	#abortController = null;
	#currentBreakpoint = null;
	#layoutCache = new Map();
	
	constructor(options = {}) {
		this.#photoModal = options.photoModal || null;
		this.#abortController = new AbortController();
		this.#initializeDOM();
		this.#setupResponsiveObserver();
		this.init();
	}

	getCurrentGallery() {
		return this.#currentGallery;
	}

	getAvailableGalleries() {
		return Array.from(this.#galleries.keys());
	}

	switchGallery(galleryKey) {
		if (!this.#galleries.has(galleryKey) || galleryKey === this.#currentGallery) {
			return false;
		}

		this.#performGallerySwitch(galleryKey);

		return true;
	}

	destroy() {
		this.#abortController?.abort();
		this.#galleries.clear();
		this.#layoutCache.clear();
		this.#currentGallery = null;
		this.#isInitialized = false;
		this.#currentBreakpoint = null;
	}

	/**
	 * Get current breakpoint based on viewport width
	 * @returns {string} Breakpoint name
	 */
	#getCurrentBreakpoint() {
		const width = window.innerWidth;
		const { BREAKPOINTS } = Galleries.CONFIG;
		
		if (width < BREAKPOINTS.MOBILE) return 'MOBILE';
		if (width < BREAKPOINTS.TABLET) return 'TABLET';
		if (width < BREAKPOINTS.DESKTOP) return 'DESKTOP';
		return 'WIDESCREEN';
	}

	/**
	 * Get row limits for a specific breakpoint
	 * @param {string} breakpoint - Breakpoint name
	 * @returns {Object} Row limits
	 */
	#getRowLimitsForBreakpoint(breakpoint) {
		return Galleries.CONFIG.ROW_LIMITS_BY_BREAKPOINT[breakpoint] || 
			   Galleries.CONFIG.ROW_LIMITS_BY_BREAKPOINT.DESKTOP;
	}

	#initializeDOM() {
		this.#galleryContainer = document.querySelector(Galleries.CONFIG.CONTAINER_SELECTOR);
		this.#buttonTemplate = document.getElementById('gallery-button-template');
		this.#thumbTemplate = document.getElementById('photo-thumb-template');
		this.#currentBreakpoint = this.#getCurrentBreakpoint();
	}

	#setupResponsiveObserver() {
		const handleResize = debounce(() => {
			const newBreakpoint = this.#getCurrentBreakpoint();
			
			if (newBreakpoint !== this.#currentBreakpoint) {
				this.#currentBreakpoint = newBreakpoint;
				
				if (this.#isInitialized && this.#currentGallery) {
					const gallery = this.#galleries.get(this.#currentGallery);
					if (gallery) {
						this.#renderGalleryAtBreakpoint(gallery, newBreakpoint);
					}
				}
			}
		}, 500);

		window.addEventListener('resize', handleResize, { 
			signal: this.#abortController.signal 
		});
	}

	async init() {
		if (!this.#galleryContainer) {
			console.error('Gallery container not found.');
			return;
		}

		if (!this.#buttonTemplate || !this.#thumbTemplate) {
			console.error('Required HTML <template> tags not found.');
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
		const signal = this.#abortController.signal;
		const response = await fetch(Galleries.CONFIG.DATA_URL, { signal });
		if (!response.ok) {
			throw new Error(`Failed to load galleries: ${response.status}`);
		}

		const data = await response.json();
		const { _config, ...galleries } = data;
		this.#galleries.clear();
		Object.entries(galleries)
			.forEach(([key, value]) => {
				this.#galleries.set(key, value);
			});
		const defaultKey = _config?.defaultGallery;
		const galleryKeys = Array.from(this.#galleries.keys());
		this.#currentGallery = (defaultKey && this.#galleries.has(defaultKey)) ? defaultKey : galleryKeys[0];
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
		this.#galleryContainer.querySelector(Galleries.CONFIG.CONTROLS_SELECTOR)
			?.remove();
		const insertPoint = this.#galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR) || this.#galleryContainer.firstElementChild;
		this.#galleryContainer.insertBefore(controls, insertPoint);
		controls.addEventListener('click', (e) => {
			const button = e.target.closest(Galleries.CONFIG.BUTTON_SELECTOR);
			if (button?.dataset?.gallery) {
				this.switchGallery(button.dataset.gallery);
			}
		}, { signal: this.#abortController.signal });
	}

	#loadDefaultGallery() {
		if (!this.#galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR)) {
			const gallery = this.#galleries.get(this.#currentGallery);
			if (gallery?.images?.length) {
				this.#renderGallery(gallery, false);
				this.#initPhotoModal();
			}
		}
	}

	/**
	 * Render gallery using cached layout for breakpoint
	 * @param {Object} gallery - Gallery data
	 * @param {string} breakpoint - Target breakpoint
	 */
	#renderGalleryAtBreakpoint(gallery, breakpoint) {
		const cacheKey = `${this.#currentGallery}-${breakpoint}`;
		
		let gridFragment;
		if (this.#layoutCache.has(cacheKey)) {
			// Use cached layout
			gridFragment = this.#layoutCache.get(cacheKey).cloneNode(true);
		} else {
			const rowLimits = this.#getRowLimitsForBreakpoint(breakpoint);
			gridFragment = this.#createPhotoGridsWithLimits(gallery.images, rowLimits);
			this.#layoutCache.set(cacheKey, gridFragment.cloneNode(true));
		}
		
		// Swap without transition for resize
		const existingGrids = this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR);
		existingGrids.forEach(grid => grid.remove());
		this.#galleryContainer.appendChild(gridFragment);
		this.#refreshPhotoModal();
	}

	#renderGallery(gallery, withTransition = true) {
		if (!gallery?.images?.length) {
			this.#galleryContainer.textContent = '';
			return;
		}
		
		if (!withTransition) {
			// For resize, use breakpoint-aware rendering
			this.#renderGalleryAtBreakpoint(gallery, this.#currentBreakpoint);
		} else {
			// For gallery switch, use transition
			const rowLimits = this.#getRowLimitsForBreakpoint(this.#currentBreakpoint);
			const newGridsFragment = this.#createPhotoGridsWithLimits(gallery.images, rowLimits);
			this.#transitionToNewGallery(newGridsFragment);
		}
	}

	/**
	 * Create photo grids with specific row limits
	 * @param {Array} images - Array of image objects
	 * @param {Object} rowLimits - Row limits to use
	 * @returns {DocumentFragment} Fragment containing the photo grids
	 */
	#createPhotoGridsWithLimits(images, rowLimits) {
		const fragment = document.createDocumentFragment();
		if (!Array.isArray(images) || images.length === 0) return fragment;
		
		const groups = this.#groupImagesByLayout(images);
		const rows = this.#generateOptimizedRowsWithLimits(groups, rowLimits);
		
		rows.forEach(row => {
			if (row.images.length > 0) {
				fragment.appendChild(this.#createImageGrid(row.images, row.rowClass));
			}
		});
		
		return fragment;
	}

	/**
	 * Group images by layout type
	 * @param {Array} images - Array of image objects
	 * @returns {Object} Grouped images
	 */
	#groupImagesByLayout(images) {
		return images.reduce((groups, image) => {
			const layout = ['landscape', 'portrait', 'pano'].includes(image.layout) ? image.layout : 'landscape';
			if (!groups[layout]) groups[layout] = [];
			groups[layout].push(image);
			return groups;
		}, {});
	}

	/**
	 * Pick any non-pano row, preferring different size
	 * @param {Object} remaining - Remaining rows by type
	 * @param {number|null} lastSize - Size of last placed row
	 * @returns {Object|null} Selected row
	 */
	#pickNonPanoRow(remaining, lastSize = null) {
		const landscape = this.#pickRowWithDifferentSize(remaining.landscape, lastSize);

		if (landscape) {
			this.#removeRow(remaining.landscape, landscape);
			return landscape;
		}

		const portrait = this.#pickRowWithDifferentSize(remaining.portrait, lastSize);
		if (portrait) {
			this.#removeRow(remaining.portrait, portrait);
			return portrait;
		}

		if (remaining.landscape.length > 0) {
			return remaining.landscape.shift();
		}

		if (remaining.portrait.length > 0) {
			return remaining.portrait.shift();
		}

		return null;
	}

	/**
	 * Row generation with explicit limits
	 * @param {Object} groups - Grouped images by layout
	 * @param {Object} rowLimits - Row limits to use
	 * @returns {Array} Array of row objects
	 */
	#generateOptimizedRowsWithLimits(groups, rowLimits) {
		const { LANDSCAPE_MAX, PORTRAIT_MAX, MIN_IMAGES } = rowLimits;

		const landscapeRows = this.#generateRowsWithLimits(groups.landscape || [], 'landscape-row', LANDSCAPE_MAX, MIN_IMAGES);
		const portraitRows = this.#generateRowsWithLimits(groups.portrait || [], 'portrait-row', PORTRAIT_MAX, MIN_IMAGES);
		const panoRows = (groups.pano || [])
			.map(image => ({
				images: [image],
				rowClass: 'pano-row'
			}));
		return this.#optimizeRowOrder([...landscapeRows, ...portraitRows, ...panoRows]);
	}

	/**
	 * @param {Array} allRows - All available rows
	 * @returns {Array} Optimized row order
	 */
	#optimizeRowOrder(allRows) {
		if (allRows.length <= 1) return allRows;

		const { landscape, portrait, pano } = this.#groupRowsByType(allRows);

		const result = [];
		let lastType = null;
		let lastSize = null;

		const remaining = {
			landscape: [...landscape],
			portrait: [...portrait],
			pano: [...pano]
		};

		while (this.#hasRemainingRows(remaining)) {
			const nextRow = this.#selectNextRow(remaining, lastType, lastSize);
			if (!nextRow) break;
			result.push(nextRow);
			lastType = nextRow.rowClass;
			lastSize = nextRow.images.length;
		}

		return this.#ensurePanoNotAtEnd(result);
	}

	/**
	 * Group rows by their type
	 * @param {Array} rows - All rows
	 * @returns {Object} Rows grouped by type
	 */
	#groupRowsByType(rows) {
		return rows.reduce((groups, row) => {
			if (row.rowClass === 'landscape-row') {
				groups.landscape.push(row);
			} else if (row.rowClass === 'portrait-row') {
				groups.portrait.push(row);
			} else if (row.rowClass === 'pano-row') {
				groups.pano.push(row);
			}
			return groups;
		}, { landscape: [], portrait: [], pano: [] });
	}

	/**
	 * Check if there are any rows left to place
	 * @param {Object} remaining - Remaining rows by type
	 * @returns {boolean}
	 */
	#hasRemainingRows(remaining) {
		return remaining.landscape.length > 0 || remaining.portrait.length > 0 || remaining.pano.length > 0;
	}

	/**
	 * @param {Object} remaining - Remaining rows by type
	 * @param {string|null} lastType - Type of last placed row
	 * @param {number|null} lastSize - Size of last placed row (INCLUDING panos)
	 * @returns {Object|null} Selected row
	 */
	#selectNextRow(remaining, lastType, lastSize) {
		// Priority 0: Never place pano after pano
		if (lastType === 'pano-row') {
			return this.#pickNonPanoRow(remaining, lastSize);
		}
		// Priority 1: Alternate between landscape and portrait when possible
		const preferredType = lastType === 'landscape-row' ? 'portrait' : 'landscape';
		const otherType = preferredType === 'landscape' ? 'portrait' : 'landscape';
		// Priority 2: Try preferred type with DIFFERENT size (most important!)
		const fromPreferred = this.#pickRowWithDifferentSize(remaining[preferredType], lastSize);
		if (fromPreferred) {
			this.#removeRow(remaining[preferredType], fromPreferred);
			return fromPreferred;
		}
		// Priority 3: Try other type with DIFFERENT size
		const fromOther = this.#pickRowWithDifferentSize(remaining[otherType], lastSize);
		if (fromOther) {
			this.#removeRow(remaining[otherType], fromOther);
			return fromOther;
		}
		// Priority 4: Use pano ONLY if it avoids same-size adjacency
		// Panos are good for breaking up patterns!
		if (remaining.pano.length > 0 && lastSize !== 1) {
			return remaining.pano.shift();
		}
		// Priority 5: Fallback - take ANY row from preferred type (even if same size)
		if (remaining[preferredType].length > 0) {
			return remaining[preferredType].shift();
		}
		// Priority 6: Take ANY row from other type
		if (remaining[otherType].length > 0) {
			return remaining[otherType].shift();
		}
		// Last resort: use remaining pano
		if (remaining.pano.length > 0) {
			return remaining.pano.shift();
		}
		return null;
	}

	/**
	 * @param {Array} rows - Array of rows to choose from
	 * @param {number|null} lastSize - Size to avoid
	 * @returns {Object|null} Row with different size, or null
	 */
	#pickRowWithDifferentSize(rows, lastSize) {
		if (!rows || rows.length === 0) return null;

		if (lastSize === null) {
			return rows[0];
		}

		return rows.find(row => row.images.length !== lastSize) || null;
	}

	/**
	 * @param {Array} rows - Array to modify
	 * @param {Object} rowToRemove - Row to remove
	 */
	#removeRow(rows, rowToRemove) {
		const index = rows.indexOf(rowToRemove);
		if (index > -1) {
			rows.splice(index, 1);
		}
	}

	/**
	 * @param {Array} rows - Current row order
	 * @returns {Array} Adjusted row order
	 */
	#ensurePanoNotAtEnd(rows) {
		if (rows.length <= 1) return rows;
		const lastRow = rows[rows.length - 1];
		if (lastRow.rowClass !== 'pano-row') return rows;

		for (let i = rows.length - 2; i >= 1; i--) {
			const current = rows[i];
			const previous = rows[i - 1];
			if (current.rowClass !== 'pano-row' && previous.rowClass !== 'pano-row') {
				const pano = rows.pop();
				rows.splice(i, 0, pano);
				return rows;
			}
		}

		return rows;
	}

	#generateRowsWithLimits(images, rowClass, maxPerRow, minImages) {
		if (images.length === 0) return [];

		if (images.length < minImages) {
			return [{ images: [...images], rowClass }];
		}
		
		const rows = [];
		let currentIndex = 0;
		
		while (currentIndex < images.length) {
			const remaining = images.length - currentIndex;
			let rowSize = Math.min(maxPerRow, remaining);

			if (remaining > maxPerRow && remaining <= maxPerRow + 1) {
				rowSize = Math.ceil(remaining / 2);
			}
			
			const rowImages = images.slice(currentIndex, currentIndex + rowSize);
			rows.push({ images: rowImages, rowClass });
			currentIndex += rowSize;
		}

		this.#ensureMinimumRowSizes(rows, minImages);
		return rows;
	}

	#ensureMinimumRowSizes(rows, minSize) {
		if (rows.length <= 1) return;
		const lastRow = rows[rows.length - 1];
		const secondLastRow = rows[rows.length - 2];
		if (lastRow.images.length < minSize && secondLastRow) {
			const needed = minSize - lastRow.images.length;
			const available = secondLastRow.images.length - minSize;
			if (available >= needed) {
				const movedImages = secondLastRow.images.splice(-needed, needed);
				lastRow.images.unshift(...movedImages);
			}
		}
	}

	/**
	 * Create image grid using templates with better error handling
	 * @param {Array} images - Images for the grid
	 * @param {string} rowClass - CSS class for the row
	 * @returns {Element} DOM element for the image grid
	 */
	#createImageGrid(images, rowClass) {
		const row = document.createElement('div');
		row.className = `photo-grid ${rowClass}`;
		row.setAttribute('role', 'group');
		const fragment = document.createDocumentFragment();
		images.forEach(image => {
			if (!this.#isValidImage(image)) {
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

	#performGallerySwitch(galleryKey) {
		this.#currentGallery = galleryKey;
		this.#updateButtonStates(galleryKey);
		this.#renderGallery(this.#galleries.get(galleryKey), true);
	}

	#updateButtonStates(activeKey) {
		const buttons = this.#galleryContainer.querySelectorAll(Galleries.CONFIG.BUTTON_SELECTOR);
		buttons.forEach(btn => {
			const isActive = btn.dataset.gallery === activeKey;
			btn.classList.toggle('active', isActive);
			btn.setAttribute('aria-selected', isActive.toString());
		});
	}

	async #transitionToNewGallery(newContentFragment) {
		const existingGrids = Array.from(this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR));

		await Promise.all(existingGrids.map(grid => this.#fadeElement(grid, 'out')));

		existingGrids.forEach(grid => grid.remove());
		const newGrids = Array.from(newContentFragment.children);
		newGrids.forEach(grid => { grid.style.opacity = '0'; });
		this.#galleryContainer.appendChild(newContentFragment);

		const fadePromises = newGrids.map((grid, index) => this.#fadeElement(grid, 'in', index * 100));
		await Promise.all(fadePromises);
		this.#refreshPhotoModal();
	}

	/**
	 * Fade element in or out with optional delay
	 * @param {Element} element - Element to fade
	 * @param {'in'|'out'} direction - Fade direction
	 * @param {number} delay - Delay in milliseconds
	 * @returns {Promise} Promise that resolves when fade completes
	 */
	#fadeElement(element, direction, delay = 0) {
		return new Promise(resolve => {
			const timeoutId = setTimeout(() => {
				element.style.transition = `opacity ${Galleries.CONFIG.TRANSITION_DURATION}ms ease`;
				
				const handleTransitionEnd = () => {
					element.removeEventListener('transitionend', handleTransitionEnd);
					clearTimeout(fallbackTimeout);
					resolve();
				};
				
				// Safety fallback: resolve after transition duration + buffer
				const fallbackTimeout = setTimeout(() => {
					element.removeEventListener('transitionend', handleTransitionEnd);
					resolve();
				}, Galleries.CONFIG.TRANSITION_DURATION + 100);
				
				element.addEventListener('transitionend', handleTransitionEnd);
				element.style.opacity = direction === 'in' ? '1' : '0';
			}, delay);
			
			this.#abortController.signal.addEventListener('abort', () => {
				clearTimeout(timeoutId);
				resolve();
			});
		});
	}

	#initPhotoModal() {
		this.#photoModal?.setupAspectRatios?.();
	}

	#refreshPhotoModal() {
		this.#photoModal?.refreshImageTracking?.();
	}

	/**
	 * Validate image object structure
	 * @param {Object} image - Image object to validate
	 * @returns {boolean} Whether image is valid
	 */
	#isValidImage(image) {
		return image?.sources && typeof image.sources === 'object' && Object.keys(image.sources)
			.length > 0;
	}
}

function initializeGalleries() {
	try {
		if (window.Galleries?.destroy) {
			window.Galleries.destroy();
		}
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