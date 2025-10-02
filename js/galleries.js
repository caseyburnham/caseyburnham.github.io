/**
 * Galleries - Streamlined photo gallery manager with smooth transitions
 * IMPROVED VERSION - Enhanced memory management, reduced complexity, modern patterns
 */
class Galleries {
	static CONFIG = {
		DATA_URL: '/json/gallery-data.json',
		CONTROLS_SELECTOR: '.gallery-controls',
		GRID_SELECTOR: '.photo-grid',
		BUTTON_SELECTOR: '.gallery-btn',
		CONTAINER_SELECTOR: '[aria-labelledby="gallery-heading"]',
		TRANSITION_DURATION: 200,
		// Extracted magic numbers to configuration
		SCORING_WEIGHTS: {
			ALTERNATING_COUNT: 1000,
			ALTERNATING_LAYOUT: 100,
			DEAD_END_PENALTY: 2000,
			COMMONALITY_BONUS: 25,
			SIZE_BONUS: 0.1
		},
		// Responsive row limits based on viewport breakpoints
		BREAKPOINTS: {
			MOBILE: 480,
			TABLET: 768,
			DESKTOP: 1024,
			WIDESCREEN: 1440
		},
		// Row limits per breakpoint [landscape_max, portrait_max, min_images]
		ROW_LIMITS_RESPONSIVE: {
			MOBILE: { LANDSCAPE_MAX: 3, PORTRAIT_MAX: 4, MIN_IMAGES: 3 },
			TABLET: { LANDSCAPE_MAX: 4, PORTRAIT_MAX: 7, MIN_IMAGES: 3 },
			DESKTOP: { LANDSCAPE_MAX: 5, PORTRAIT_MAX: 7, MIN_IMAGES: 3 },
			WIDESCREEN: { LANDSCAPE_MAX: 5, PORTRAIT_MAX: 7, MIN_IMAGES: 3 }
		},
		// Fallback limits
		ROW_LIMITS: {
			LANDSCAPE_MAX: 4,
			PORTRAIT_MAX: 5,
			MIN_IMAGES: 3
		}
	};

	#galleries = new Map(); // Use Map for better performance
	#currentGallery = null;
	#isInitialized = false;
	#photoModal = null;
	#galleryContainer = null;
	#buttonTemplate = null;
	#thumbTemplate = null;
	#abortController = null; // For cleanup
	#resizeObserver = null; // For responsive behavior
	#currentRowLimits = null; // Cached current limits

	constructor(options = {}) {
		this.#photoModal = options.photoModal || null;
		this.#abortController = new AbortController();
		
		this.#initializeDOM();
		this.#setupResponsiveObserver();
		this.init();
	}

	// Public API with better encapsulation
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

	/**
	 * Clean up resources and event listeners
	 */
	destroy() {
		this.#abortController?.abort();
		this.#resizeObserver?.disconnect();
		this.#galleries.clear();
		this.#currentGallery = null;
		this.#isInitialized = false;
		this.#currentRowLimits = null;
	}

	// Initialization
	#initializeDOM() {
		this.#galleryContainer = document.querySelector(Galleries.CONFIG.CONTAINER_SELECTOR);
		this.#buttonTemplate = document.getElementById('gallery-button-template');
		this.#thumbTemplate = document.getElementById('photo-thumb-template');
		this.#currentRowLimits = this.#calculateRowLimits();
	}

	/**
	 * Set up ResizeObserver for responsive behavior
	 */
	#setupResponsiveObserver() {
		if (!('ResizeObserver' in window)) {
			// Fallback for older browsers
			window.addEventListener('resize', 
				this.#debounce(() => this.#handleViewportChange(), 300), 
				{ signal: this.#abortController.signal }
			);
			return;
		}

		this.#resizeObserver = new ResizeObserver(
			this.#debounce((entries) => {
				for (const entry of entries) {
					if (entry.target === this.#galleryContainer) {
						this.#handleViewportChange();
						break;
					}
				}
			}, 200)
		);
	}

	/**
	 * Handle viewport size changes and re-render if needed
	 */
	#handleViewportChange() {
		const newLimits = this.#calculateRowLimits();
		
		// Check if limits actually changed
		if (!this.#rowLimitsChanged(newLimits, this.#currentRowLimits)) {
			return;
		}
		
		this.#currentRowLimits = newLimits;
		
		// Re-render current gallery with new limits if initialized
		if (this.#isInitialized && this.#currentGallery) {
			const gallery = this.#galleries.get(this.#currentGallery);
			if (gallery) {
				this.#renderGallery(gallery, true);
			}
		}
	}

	/**
	 * Calculate appropriate row limits based on current viewport
	 * @returns {Object} Row limits for current viewport
	 */
	#calculateRowLimits() {
		const containerWidth = this.#galleryContainer?.clientWidth || window.innerWidth;
		const { BREAKPOINTS, ROW_LIMITS_RESPONSIVE } = Galleries.CONFIG;
		
		if (containerWidth >= BREAKPOINTS.WIDESCREEN) {
			return ROW_LIMITS_RESPONSIVE.WIDESCREEN;
		} else if (containerWidth >= BREAKPOINTS.DESKTOP) {
			return ROW_LIMITS_RESPONSIVE.DESKTOP;
		} else if (containerWidth >= BREAKPOINTS.TABLET) {
			return ROW_LIMITS_RESPONSIVE.TABLET;
		} else {
			return ROW_LIMITS_RESPONSIVE.MOBILE;
		}
	}

	/**
	 * Check if row limits have changed
	 * @param {Object} newLimits - New row limits
	 * @param {Object} currentLimits - Current row limits
	 * @returns {boolean} Whether limits changed
	 */
	#rowLimitsChanged(newLimits, currentLimits) {
		if (!currentLimits) return true;
		
		return newLimits.LANDSCAPE_MAX !== currentLimits.LANDSCAPE_MAX ||
			   newLimits.PORTRAIT_MAX !== currentLimits.PORTRAIT_MAX ||
			   newLimits.MIN_IMAGES !== currentLimits.MIN_IMAGES;
	}

	/**
	 * Debounce function to limit resize event frequency
	 * @param {Function} func - Function to debounce
	 * @param {number} wait - Wait time in milliseconds
	 * @returns {Function} Debounced function
	 */
	#debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
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
			
			// Start observing container for size changes
			if (this.#resizeObserver && this.#galleryContainer) {
				this.#resizeObserver.observe(this.#galleryContainer);
			}
			
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

		// Use Map for better performance with dynamic keys
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
				id: img.dataset.filename || `img-${crypto.randomUUID()}`, // Use crypto.randomUUID() for better performance
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

		// Use DocumentFragment for efficient DOM building
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
		
		// Clean up existing controls
		this.#galleryContainer.querySelector(Galleries.CONFIG.CONTROLS_SELECTOR)?.remove();
		
		const insertPoint = this.#galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR) 
			|| this.#galleryContainer.firstElementChild;
		this.#galleryContainer.insertBefore(controls, insertPoint);

		// Use event delegation with abort signal for cleanup
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

	#renderGallery(gallery, withTransition = true) {
		if (!gallery?.images?.length) {
			this.#galleryContainer.innerHTML = '';
			return;
		}
		
		const newGridsFragment = this.#createPhotoGrids(gallery.images);
		
		if (!withTransition) {
			this.#galleryContainer.appendChild(newGridsFragment);
		} else {
			this.#transitionToNewGallery(newGridsFragment);
		}
	}

	/**
	 * IMPROVED: Simplified photo grid creation with better memory management
	 * @param {Array} images - Array of image objects
	 * @returns {DocumentFragment} Fragment containing the photo grids
	 */
	#createPhotoGrids(images) {
		const fragment = document.createDocumentFragment();
		if (!Array.isArray(images) || images.length === 0) return fragment;

		// Step 1: Group images by layout (more memory efficient)
		const groups = this.#groupImagesByLayout(images);
		
		// Step 2: Generate optimized rows using streaming approach
		const rows = this.#generateOptimizedRows(groups);
		
		// Step 3: Render rows to fragment
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
			const layout = ['landscape', 'portrait', 'pano'].includes(image.layout) 
				? image.layout 
				: 'landscape';
			
			if (!groups[layout]) groups[layout] = [];
			groups[layout].push(image);
			return groups;
		}, {});
	}

	/**
	 * IMPROVED: Responsive row generation with viewport-aware limits
	 * @param {Object} groups - Grouped images by layout
	 * @returns {Array} Array of row objects
	 */
	#generateOptimizedRows(groups) {
		const rowLimits = this.#currentRowLimits || this.#calculateRowLimits();
		const { LANDSCAPE_MAX, PORTRAIT_MAX } = rowLimits;
		
		// Generate individual row types with responsive limits
		const landscapeRows = this.#generateRows(groups.landscape || [], 'landscape-row', LANDSCAPE_MAX);
		const portraitRows = this.#generateRows(groups.portrait || [], 'portrait-row', PORTRAIT_MAX);
		const panoRows = (groups.pano || []).map(image => ({ 
			images: [image], 
			rowClass: 'pano-row' 
		}));

		// Use more efficient row ordering algorithm
		return this.#optimizeRowOrder([...landscapeRows, ...portraitRows, ...panoRows]);
	}

	/**
	 * IMPROVED: Strategic row ordering algorithm with proper alternation rules
	 * @param {Array} allRows - All available rows
	 * @returns {Array} Optimized row order
	 */
	#optimizeRowOrder(allRows) {
		if (allRows.length <= 1) return allRows;

		const result = [];
		const remaining = [...allRows]; // Work with a copy
		let lastRow = null;

		while (remaining.length > 0) {
			// Filter candidates based on hard constraints (pano rules)
			const validCandidates = remaining.filter(row => 
				this.#isValidNextRow(row, lastRow)
			);
			
			const candidatesToScore = validCandidates.length > 0 ? validCandidates : remaining;

			if (candidatesToScore.length === 1) {
				// Only one choice, take it
				const chosen = candidatesToScore[0];
				result.push(chosen);
				this.#removeFromArray(remaining, chosen);
				lastRow = chosen;
				continue;
			}

			// Calculate size distribution for strategic decisions
			const sizeCounts = this.#calculateSizeCounts(candidatesToScore);
			const uniqueSizeCount = Object.keys(sizeCounts).length;

			// Score each candidate using the original sophisticated logic
			const bestRow = this.#selectBestRowAdvanced(
				candidatesToScore, 
				lastRow, 
				sizeCounts, 
				uniqueSizeCount,
				remaining
			);

			result.push(bestRow);
			this.#removeFromArray(remaining, bestRow);
			lastRow = bestRow;
		}

		// Post-process to handle pano placement rules
		return this.#adjustPanoPlacement(result);
	}

	/**
	 * Check if a row can follow the previous row
	 * @param {Object} row - Row to check
	 * @param {Object|null} lastRow - Previous row
	 * @returns {boolean} Whether the row is valid
	 */
	#isValidNextRow(row, lastRow) {
		if (!lastRow) return row.rowClass !== 'pano-row';
		return !(lastRow.rowClass === 'pano-row' && row.rowClass === 'pano-row');
	}

	/**
	 * Advanced row selection with sophisticated scoring (restored original logic)
	 * @param {Array} candidates - Available candidate rows
	 * @param {Object|null} lastRow - Previous row
	 * @param {Object} sizeCounts - Count of rows by size
	 * @param {number} uniqueSizeCount - Number of unique sizes
	 * @param {Array} remaining - All remaining rows
	 * @returns {Object} Best scoring row
	 */
	#selectBestRowAdvanced(candidates, lastRow, sizeCounts, uniqueSizeCount, remaining) {
		const weights = Galleries.CONFIG.SCORING_WEIGHTS;
		
		const scoredCandidates = candidates.map(candidate => {
			let score = 0;
			const candidateSize = candidate.images.length;

			// a. Highest priority: Reward alternating image counts
			if (!lastRow || candidateSize !== lastRow.images.length) {
				score += weights.ALTERNATING_COUNT;
			}

			// b. Secondary priority: Reward alternating layouts  
			if (!lastRow || candidate.rowClass !== lastRow.rowClass) {
				score += weights.ALTERNATING_LAYOUT;
			}

			// c. "Look-Ahead" Penalty: Punish choices that lead to a dead end
			if (uniqueSizeCount > 1 && sizeCounts[candidateSize] === 1) {
				const otherCandidates = candidates.filter(r => r !== candidate);
				if (otherCandidates.length > 1 && 
					new Set(otherCandidates.map(r => r.images.length)).size === 1) {
					score -= weights.DEAD_END_PENALTY; // Heavy penalty for this "trap" choice
				}
			}

			// d. Commonality Bonus: Prefer using rows from a larger group
			// This prevents picking scarce rows (like a single '5') too early
			score += (sizeCounts[candidateSize] - 1) * weights.COMMONALITY_BONUS;

			// e. Final Tie-breaker: Small bonus for size
			score += candidateSize * weights.SIZE_BONUS;

			return { candidate, score };
		});

		// Sort by highest score and return the best choice
		scoredCandidates.sort((a, b) => b.score - a.score);
		return scoredCandidates[0]?.candidate || candidates[0];
	}

	/**
	 * Calculate size distribution for strategic decisions
	 * @param {Array} rows - Array of rows to analyze
	 * @returns {Object} Count of rows by image count
	 */
	#calculateSizeCounts(rows) {
		return rows.reduce((acc, row) => {
			const size = row.images.length;
			acc[size] = (acc[size] || 0) + 1;
			return acc;
		}, {});
	}

	/**
	 * Remove item from array (helper method)
	 * @param {Array} array - Array to modify
	 * @param {*} item - Item to remove
	 */
	#removeFromArray(array, item) {
		const index = array.indexOf(item);
		if (index > -1) {
			array.splice(index, 1);
		}
	}

	/**
	 * Adjust panorama placement to avoid ending with panos
	 * @param {Array} rows - Current row order
	 * @returns {Array} Adjusted row order
	 */
	#adjustPanoPlacement(rows) {
		if (rows.length <= 1) return rows;
		
		const lastRow = rows[rows.length - 1];
		if (lastRow.rowClass !== 'pano-row') return rows;
		
		// Find a safe insertion point for the trailing pano
		for (let i = Math.max(0, rows.length - 3); i >= 1; i--) {
			const prevRow = rows[i - 1];
			const nextRow = rows[i];
			
			if (prevRow.rowClass !== 'pano-row' && nextRow.rowClass !== 'pano-row') {
				const pano = rows.pop();
				rows.splice(i, 0, pano);
				break;
			}
		}
		
		return rows;
	}

	/**
	 * IMPROVED: Responsive row generation with viewport-aware minimum sizes
	 * @param {Array} images - Images to arrange in rows
	 * @param {string} rowClass - CSS class for the row
	 * @param {number} maxPerRow - Maximum images per row (responsive)
	 * @returns {Array} Array of row objects
	 */
	#generateRows(images, rowClass, maxPerRow) {
		if (images.length === 0) return [];
		
		const rowLimits = this.#currentRowLimits || this.#calculateRowLimits();
		const { MIN_IMAGES } = rowLimits;
		
		// Handle small galleries
		if (images.length < MIN_IMAGES) {
			return [{ images: [...images], rowClass }];
		}

		const rows = [];
		let currentIndex = 0;

		while (currentIndex < images.length) {
			const remaining = images.length - currentIndex;
			let rowSize = Math.min(maxPerRow, remaining);
			
			// Adjust row size to avoid small final rows
			if (remaining > maxPerRow && remaining <= maxPerRow + 1) {
				rowSize = Math.ceil(remaining / 2);
			}
			
			const rowImages = images.slice(currentIndex, currentIndex + rowSize);
			rows.push({ images: rowImages, rowClass });
			currentIndex += rowSize;
		}

		// Post-process to ensure minimum row sizes
		this.#ensureMinimumRowSizes(rows, MIN_IMAGES);
		
		return rows;
	}

	/**
	 * Ensure all rows meet minimum size requirements
	 * @param {Array} rows - Array of row objects to adjust
	 * @param {number} minSize - Minimum row size
	 */
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
			if (!this.#isValidImage(image)) return;
			
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
		const existingGrids = Array.from(
			this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR)
		);
		
		// Fade out existing grids
		await Promise.all(existingGrids.map(grid => this.#fadeElement(grid, 'out')));
		
		// Remove old content
		existingGrids.forEach(grid => grid.remove());

		// Prepare new content
		const newGrids = Array.from(newContentFragment.children);
		newGrids.forEach(grid => { grid.style.opacity = '0'; });
		this.#galleryContainer.appendChild(newContentFragment);

		// Fade in new grids with stagger
		const fadePromises = newGrids.map((grid, index) => 
			this.#fadeElement(grid, 'in', index * 100)
		);
		
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
					resolve();
				};
				
				element.addEventListener('transitionend', handleTransitionEnd);
				element.style.opacity = direction === 'in' ? '1' : '0';
			}, delay);
			
			// Cleanup timeout if component is destroyed
			this.#abortController.signal.addEventListener('abort', () => {
				clearTimeout(timeoutId);
				resolve();
			});
		});
	}

	// Photo modal integration with better error handling
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
		return image?.sources && 
			typeof image.sources === 'object' && 
			Object.keys(image.sources).length > 0;
	}
}

/**
 * Initialize galleries with better error handling and cleanup
 */
function initializeGalleries() {
	try {
		// Clean up existing instance
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

// Enhanced initialization with proper cleanup
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeGalleries);
} else {
	initializeGalleries();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	window.Galleries?.destroy();
});