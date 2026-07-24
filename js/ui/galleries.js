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
		MIN_IMAGES: 3,
		MAX_ROW_PLANS: 128,
		ROW_REPEAT_PENALTY: 12,
		ROW_JUMP_PENALTY: 6,
		SAME_LAYOUT_PENALTY: 2,
		ROW_ASCENT_PENALTY: 8
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

		// Group by layout and keep each orientation newest-first.
		const groups = {
			landscape: this.#sortByDate(images.filter(img => img.layout === 'landscape')),
			portrait: this.#sortByDate(images.filter(img => img.layout === 'portrait')),
			pano: this.#sortByDate(images.filter(img => img.layout === 'pano'))
		};

		const landscapePlans = this.#createRowPlans(groups.landscape, 'landscape-row', LANDSCAPE_MAX, MIN_IMAGES);
		const portraitPlans = this.#createRowPlans(groups.portrait, 'portrait-row', PORTRAIT_MAX, MIN_IMAGES);
		const { landscapeRows, portraitRows } = this.#selectRowPlans(
			landscapePlans,
			portraitPlans
		);
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

	#sortByDate(images) {
		return [...images].sort((a, b) => {
			const dateComparison = (b.dateCreated || '').localeCompare(a.dateCreated || '');
			return dateComparison || (a.id || '').localeCompare(b.id || '');
		});
	}

	#createRowPlans(images, rowClass, maxPerRow, minImages) {
		if (!images?.length) return [[]];
		if (images.length < minImages) {
			return [[{ images: [...images], rowClass }]];
		}

		const rowSizes = [];
		let remaining = images.length;
		while (remaining > 0) {
			let rowSize;
			if (remaining <= maxPerRow) {
				rowSize = remaining;
			} else if (remaining <= maxPerRow + minImages) {
				rowSize = Math.ceil(remaining / 2);
			} else {
				rowSize = maxPerRow;
			}
			rowSizes.push(rowSize);
			remaining -= rowSize;
		}

		const sizePlans = [];
		const collectPlans = (unused, sizes = []) => {
			if (sizePlans.length >= Galleries.CONFIG.MAX_ROW_PLANS) return;
			if (unused.length === 0) {
				sizePlans.push(sizes);
				return;
			}

			const usedSizes = new Set();
			unused.forEach((size, index) => {
				if (usedSizes.has(size)) return;
				usedSizes.add(size);
				collectPlans(
					unused.filter((_, unusedIndex) => unusedIndex !== index),
					[...sizes, size]
				);
			});
		};
		collectPlans(rowSizes);

		return sizePlans.map(sizes => {
			let offset = 0;
			return sizes.map(size => {
				const row = {
					images: images.slice(offset, offset + size),
					rowClass
				};
				offset += size;
				return row;
			});
		});
	}

	#selectRowPlans(landscapePlans, portraitPlans) {
		let best = null;

		landscapePlans.forEach(landscapeRows => {
			portraitPlans.forEach(portraitRows => {
				const rows = this.#interleaveRows(landscapeRows, portraitRows, []);
				const score = this.#scoreRowPlan(rows, landscapeRows, portraitRows);
				if (!best || score < best.score) {
					best = { landscapeRows, portraitRows, score };
				}
			});
		});

		return best || { landscapeRows: [], portraitRows: [] };
	}

	#scoreRowPlan(rows, landscapeRows, portraitRows) {
		const {
			ROW_REPEAT_PENALTY,
			ROW_JUMP_PENALTY,
			SAME_LAYOUT_PENALTY,
			ROW_ASCENT_PENALTY
		} = Galleries.CONFIG;
		let score = 0;

		for (let index = 1; index < rows.length; index++) {
			const previous = rows[index - 1];
			const current = rows[index];
			const difference = Math.abs(previous.images.length - current.images.length);

			if (difference === 0) score += ROW_REPEAT_PENALTY;
			if (difference >= 2) score += (difference - 1) * ROW_JUMP_PENALTY;
			if (previous.rowClass === current.rowClass) score += SAME_LAYOUT_PENALTY;
		}
		[landscapeRows, portraitRows].forEach(rowPlan => {
			for (let index = 1; index < rowPlan.length; index++) {
				const increase = rowPlan[index].images.length - rowPlan[index - 1].images.length;
				if (increase > 0) score += increase * ROW_ASCENT_PENALTY;
			}
		});

		return score;
	}

	#interleaveRows(landscapeRows, portraitRows, panoRows) {
		let nonPanoRows;
		if (landscapeRows.length >= portraitRows.length + 2 && portraitRows.length >= 2) {
			nonPanoRows = [
				...landscapeRows.slice(0, -1),
				...portraitRows.slice(0, -1),
				landscapeRows.at(-1),
				portraitRows.at(-1)
			];
		} else {
			nonPanoRows = [];
			const maxLength = Math.max(landscapeRows.length, portraitRows.length);
			for (let index = 0; index < maxLength; index++) {
				if (index < landscapeRows.length) nonPanoRows.push(landscapeRows[index]);
				if (index < portraitRows.length) nonPanoRows.push(portraitRows[index]);
			}
		}
		if (panoRows.length === 0) return nonPanoRows;

		const panoSlots = Array.from(
			{ length: nonPanoRows.length + 1 },
			() => []
		);
		panoRows.forEach((row, index) => {
			const slot = Math.floor(
				((index + 1) * nonPanoRows.length) / (panoRows.length + 1)
			);
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
			const source = Object.values(image.sources)[0];
			
			img.src = image.thumbnail || '';
			img.alt = image.alt || 'Untitled';
			img.setAttribute('data-sources', JSON.stringify(image.sources));
			img.setAttribute('data-title', image.title || image.alt || 'Untitled');
			if (image.id) img.setAttribute('data-filename', image.id);

			thumbClone.querySelector('.photo-content-url').href = source;
			thumbClone.querySelector('.photo-name').content = image.title || image.alt || 'Untitled';
			thumbClone.querySelector('.photo-description').content = image.alt || image.title || 'Untitled';

			const dateCreated = thumbClone.querySelector('.photo-date-created');
			if (image.dateCreated) {
				dateCreated.content = image.dateCreated;
			} else {
				dateCreated.remove();
			}

			const copyrightNotice = thumbClone.querySelector('.photo-copyright-notice');
			if (image.copyrightNotice) {
				copyrightNotice.content = image.copyrightNotice;
			} else {
				copyrightNotice.remove();
			}
			
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
