/**
 * Interactive photo galleries.
 */
export class Galleries {
	static CONFIG = {
		DATA_URL: '/json/gallery-data.json',
		GRID_SELECTOR: '.photo-grid',
		BUTTON_SELECTOR: '.gallery-btn',
		CONTAINER_SELECTOR: '#galleries',
		LANDSCAPE_MAX: 5,
		PORTRAIT_MAX: 6,
		MIN_IMAGES: 3
	};

	#galleries = new Map();
	#currentGallery = null;
	#galleryContainer = null;
	#controlsTemplate = null;
	#buttonTemplate = null;
	#gridTemplate = null;
	#thumbTemplate = null;
	#clickHandler = null;
	#transitionVersion = 0;
	
	constructor() {
		this.#initializeDOM();
	}

	destroy() {
		// Clean up event listeners
		if (this.#clickHandler) {
			const controls = this.#galleryContainer?.querySelector('.gallery-controls');
			controls?.removeEventListener('click', this.#clickHandler);
		}

		this.#galleries.clear();
		this.#currentGallery = null;
		this.#clickHandler = null;
		this.#transitionVersion++;
	}

	#initializeDOM() {
		this.#galleryContainer = document.querySelector(Galleries.CONFIG.CONTAINER_SELECTOR);
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
		} catch (error) {
			console.error('Gallery initialization failed:', error);
			this.#galleryContainer.dataset.state = 'error';
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
		this.#galleryContainer.querySelector('.gallery-controls')?.remove();
		
		const insertPoint = this.#galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR) 
			|| this.#galleryContainer.firstElementChild;
		this.#galleryContainer.insertBefore(controlsFragment, insertPoint);

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
		} else {
			const existingGrids = this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR);
			existingGrids.forEach(grid => grid.remove());
			this.#galleryContainer.appendChild(newGridsFragment);
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
		const gridFragment = this.#gridTemplate.content.cloneNode(true);
		const row = gridFragment.querySelector(Galleries.CONFIG.GRID_SELECTOR);
		row.classList.add(rowClass);

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
		return gridFragment;
	}

	async #transitionToNewGallery(newContentFragment) {
		const transitionVersion = ++this.#transitionVersion;
		const existingGrids = Array.from(
			this.#galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR)
		);
		const newGrids = Array.from(newContentFragment.children);

		const shouldSkipAnimation =
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			typeof Element.prototype.animate !== 'function';

		if (shouldSkipAnimation) {
			existingGrids.forEach(grid => grid.remove());
			this.#galleryContainer.appendChild(newContentFragment);
			return;
		}

		await this.#animateElements(
			existingGrids,
			[{ opacity: 1 }, { opacity: 0 }],
			{ duration: 200, easing: 'ease-in' }
		);

		if (transitionVersion !== this.#transitionVersion) return;

		existingGrids.forEach(grid => grid.remove());
		this.#galleryContainer.appendChild(newContentFragment);

		const thumbnails = newGrids.flatMap(grid =>
			Array.from(grid.querySelectorAll('.photo-thumb'))
		);

		await this.#animateElements(
			thumbnails,
			[
				{ opacity: 0, transform: 'translateY(0.625rem)' },
				{ opacity: 1, transform: 'translateY(0)' }
			],
			{ duration: 300, easing: 'ease-out', stagger: 40 }
		);
	}

	async #animateElements(elements, keyframes, options) {
		const { stagger = 0, ...animationOptions } = options;
		const animations = elements.map((element, index) =>
			element.animate(keyframes, {
				...animationOptions,
				delay: index * stagger,
				fill: 'backwards'
			})
		);

		await Promise.allSettled(animations.map(animation => animation.finished));
	}
}