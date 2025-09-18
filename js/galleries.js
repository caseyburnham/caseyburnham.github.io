/**
 * Galleries - Streamlined photo gallery manager with smooth transitions
 * REFACtORED VERSION
 */
class Galleries {
	static CONFIG = {
		DATA_URL: '/json/gallery-data.json',
		CONTROLS_SELECTOR: '.gallery-controls',
		GRID_SELECTOR: '.photo-grid',
		BUTTON_SELECTOR: '.gallery-btn',
		CONTAINER_SELECTOR: '[aria-labelledby="gallery-heading"]',
		TRANSITION_DURATION: 200, // in ms
	};

	constructor(options = {}) {
		this.galleries = {};
		this.currentGallery = null;
		this.isInitialized = false;

		// --- REFACTOR: Use dependency injection for photoModal ---
		this.photoModal = options.photoModal || null;

		this.galleryContainer = document.querySelector(Galleries.CONFIG.CONTAINER_SELECTOR);
		this.buttonTemplate = document.getElementById('gallery-button-template');
		this.thumbTemplate = document.getElementById('photo-thumb-template');

		this.init();
	}

	// Public API
	getCurrentGallery = () => this.currentGallery;
	getAvailableGalleries = () => Object.keys(this.galleries);

	switchGallery(galleryKey) {
		if (!this.galleries[galleryKey] || galleryKey === this.currentGallery) {
			return false;
		}
		this.performGallerySwitch(galleryKey);
		return true;
	}

	// Initialization
	async init() {
		if (!this.galleryContainer) {
			console.error('Gallery container not found.');
			return;
		}
		// --- REFACTOR: Check for required templates ---
		if (!this.buttonTemplate || !this.thumbTemplate) {
			console.error('Required HTML <template> tags not found.');
			this.createFallbackGallery(); // Attempt fallback without templates if possible
			return;
		}
		try {
			await this.loadGalleries();
			this.renderControls();
			this.isInitialized = true;
		} catch (error) {
			console.error('Gallery initialization failed:', error);
			this.createFallbackGallery();
		}
	}

	async loadGalleries() {
		const response = await fetch(Galleries.CONFIG.DATA_URL);
		if (!response.ok) throw new Error(`Failed to load galleries: ${response.status}`);
		
		const data = await response.json();
		const { _config, ...galleries } = data;

		this.galleries = galleries;
		const defaultKey = _config?.defaultGallery;
		this.currentGallery = (defaultKey && galleries[defaultKey]) ? defaultKey : Object.keys(galleries)[0];

		this.loadDefaultGallery();
	}

	// Fallback logic remains largely the same
	createFallbackGallery() {
		// This method might need adjustment if it also relies on templates
		// For now, we'll assume it generates its own simple markup or that the templates exist
		const images = Array.from(document.querySelectorAll('.photo-thumb img'))
			.filter(img => img.src)
			.map(img => ({
				id: img.dataset.filename || `img-${Math.random().toString(36).substr(2, 9)}`,
				sources: { avif: img.src },
				thumbnail: img.src,
				alt: img.alt || 'Untitled',
				title: img.dataset.title || img.alt || 'Untitled',
				layout: 'landscape',
			}));

		this.galleries = { fallback: { name: 'Photo Gallery', images } };
		this.currentGallery = 'fallback';
		this.renderControls();
		this.renderGallery(this.galleries.fallback);
	}

	// --- REFACTOR: Simplified control rendering using templates ---
	renderControls() {
		const galleryKeys = Object.keys(this.galleries);
		if (galleryKeys.length <= 1) return;

		const controls = document.createElement('div');
		controls.className = 'gallery-controls';

		const buttonsContainer = document.createElement('div');
		buttonsContainer.className = 'gallery-buttons';
		buttonsContainer.role = 'tablist';
		buttonsContainer.setAttribute('aria-label', 'Photo galleries');

		galleryKeys.forEach(key => {
			const gallery = this.galleries[key];
			const isActive = key === this.currentGallery;
			
			const buttonClone = this.buttonTemplate.content.cloneNode(true);
			const button = buttonClone.querySelector('button');
			
			button.dataset.gallery = key;
			button.textContent = gallery.name || key;
			button.classList.toggle('active', isActive);
			button.setAttribute('aria-selected', isActive);
			
			buttonsContainer.appendChild(buttonClone);
		});

		controls.appendChild(buttonsContainer);
		
		this.galleryContainer.querySelector(Galleries.CONFIG.CONTROLS_SELECTOR)?.remove();
		const insertPoint = this.galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR) || this.galleryContainer.firstElementChild;
		this.galleryContainer.insertBefore(controls, insertPoint);

		controls.addEventListener('click', (e) => {
			const button = e.target.closest(Galleries.CONFIG.BUTTON_SELECTOR);
			if (button?.dataset?.gallery) {
				this.switchGallery(button.dataset.gallery);
			}
		});
	}
	
	loadDefaultGallery() {
		if (!this.galleryContainer.querySelector(Galleries.CONFIG.GRID_SELECTOR)) {
			const gallery = this.galleries[this.currentGallery];
			if (gallery?.images?.length) {
				this.renderGallery(gallery, false); // No transition on initial load
				this.initPhotoModal();
			}
		}
	}

	renderGallery(gallery, withTransition = true) {
		if (!gallery.images?.length) {
			this.galleryContainer.innerHTML = '';
			return;
		}
		const newGridsFragment = this.createPhotoGrids(gallery.images);
		if (!withTransition) {
			this.galleryContainer.appendChild(newGridsFragment);
		} else {
			this.transitionToNewGallery(newGridsFragment);
		}
	}

	// The complex row generation logic is kept, as it's a feature
	// but could be a candidate for future simplification if desired.
	createPhotoGrids(images) {
		const fragment = document.createDocumentFragment();
		if (!Array.isArray(images)) return fragment;

		const groups = images.reduce((acc, image) => {
			const layout = ['landscape', 'portrait', 'pano'].includes(image.layout) ? image.layout : 'landscape';
			acc[layout].push(image);
			return acc;
		}, { landscape: [], portrait: [], pano: [] });

		const landscapeRows = this.generateRows(groups.landscape, 'landscape-row', 4);
		const portraitRows = this.generateRows(groups.portrait, 'portrait-row', 5);
		const panoRows = groups.pano.map(image => ({ images: [image], rowClass: 'pano-row' }));

		const allRows = [];
		const maxLength = Math.max(landscapeRows.length, portraitRows.length, panoRows.length);
		for (let i = 0; i < maxLength; i++) {
			if (landscapeRows[i]) allRows.push(landscapeRows[i]);
			if (panoRows[i]) allRows.push(panoRows[i]);
			if (portraitRows[i]) allRows.push(portraitRows[i]);
		}

		allRows.forEach(row => {
			if (row.images.length > 0) {
				fragment.appendChild(this.createImageGrid(row.images, row.rowClass));
			}
		});
		return fragment;
	}

	generateRows(images, rowClass, maxPerRow) {
		if (!images.length) return [];
		const rows = [];
		for (let i = 0; i < images.length; ) {
			const remaining = images.length - i;
			let numInRow = maxPerRow;

			if (remaining > maxPerRow && remaining <= maxPerRow + 1) {
				numInRow = Math.ceil(remaining / 2);
			} else if (remaining <= maxPerRow) {
				numInRow = remaining;
			}
			const chunk = images.slice(i, i + numInRow);
			rows.push({ images: chunk, rowClass });
			i += chunk.length;
		}
		return rows;
	}

	// --- REFACTOR: Simplified image grid creation using templates ---
	createImageGrid(images, rowClass) {
		const row = document.createElement('div');
		row.className = `photo-grid ${rowClass}`;
		row.setAttribute('role', 'group');

		images.forEach(image => {
			if (!this.isValidImage(image)) return;
			
			const thumbClone = this.thumbTemplate.content.cloneNode(true);
			const img = thumbClone.querySelector('img');

			img.src = image.thumbnail || '';
			img.alt = image.alt || 'Untitled';
			img.setAttribute('data-sources', JSON.stringify(image.sources));
			img.setAttribute('data-title', image.title || image.alt || 'Untitled');
			if (image.id) img.setAttribute('data-filename', image.id);
			
			row.appendChild(thumbClone);
		});
		return row;
	}

	performGallerySwitch(galleryKey) {
		this.currentGallery = galleryKey;
		this.updateButtonStates(galleryKey);
		this.renderGallery(this.galleries[galleryKey], true);
	}
	
	updateButtonStates(activeKey) {
		this.galleryContainer.querySelectorAll(Galleries.CONFIG.BUTTON_SELECTOR).forEach(btn => {
			const isActive = btn.dataset.gallery === activeKey;
			btn.classList.toggle('active', isActive);
			btn.setAttribute('aria-selected', isActive.toString());
		});
	}

	async transitionToNewGallery(newContentFragment) {
		const existingGrids = [...this.galleryContainer.querySelectorAll(Galleries.CONFIG.GRID_SELECTOR)];
		
		await Promise.all(existingGrids.map(grid => this.fade(grid, 'out')));
		
		existingGrids.forEach(grid => grid.remove());

		const newGrids = [...newContentFragment.children];
		newGrids.forEach(grid => (grid.style.opacity = '0'));
		this.galleryContainer.appendChild(newContentFragment);

		for (const [index, grid] of newGrids.entries()) {
			await this.fade(grid, 'in', index * 100);
		}
		this.refreshPhotoModal();
	}

	fade(element, direction, delay = 0) {
		return new Promise(resolve => {
			setTimeout(() => {
				element.style.transition = `opacity ${Galleries.CONFIG.TRANSITION_DURATION}ms ease`;
				element.addEventListener('transitionend', resolve, { once: true });
				element.style.opacity = direction === 'in' ? '1' : '0';
			}, delay);
		});
	}

	// --- REFACTOR: Use the injected dependency ---
	initPhotoModal = () => this.photoModal?.setupAspectRatios?.();
	refreshPhotoModal = () => this.photoModal?.refreshImageTracking?.();

	isValidImage = (image) => image?.sources && typeof image.sources === 'object' && Object.keys(image.sources).length > 0;
}


function initializeGalleries() {
	try {
		// --- REFACTOR: Pass dependencies during instantiation ---
		window.Galleries = new Galleries({
			photoModal: window.photoModal // Pass the global object as a dependency
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