/**
 * Photo Galleries - Simplified
 */
import { debounce } from './utils/shared-utils.js';

class Galleries {
	constructor(photoModal) {
		this.photoModal = photoModal;
		this.galleries = new Map();
		this.currentGallery = null;
		this.container = document.querySelector('[aria-labelledby="gallery-heading"]');
		this.buttonTemplate = document.getElementById('gallery-button-template');
		this.thumbTemplate = document.getElementById('photo-thumb-template');
		
		if (!this.container || !this.buttonTemplate || !this.thumbTemplate) {
			console.error('Gallery elements not found');
			return;
		}
		
		this.init();
	}
	
	async init() {
		try {
			await this.loadGalleries();
			this.renderControls();
			this.renderGallery(this.galleries.get(this.currentGallery));
			this.photoModal?.setupAspectRatios?.();
			
			// Handle resize
			window.addEventListener('resize', debounce(() => {
				const gallery = this.galleries.get(this.currentGallery);
				if (gallery) this.renderGallery(gallery);
			}, 250));
		} catch (error) {
			console.error('Gallery initialization failed:', error);
		}
	}
	
	async loadGalleries() {
		const response = await fetch('/json/gallery-data.json');
		if (!response.ok) throw new Error(`Failed to load galleries: ${response.status}`);
		
		const data = await response.json();
		const { _config, ...galleries } = data;
		
		// Store galleries
		Object.entries(galleries).forEach(([key, value]) => {
			this.galleries.set(key, value);
		});
		
		// Set default
		const keys = Array.from(this.galleries.keys());
		this.currentGallery = (_config?.defaultGallery && this.galleries.has(_config.defaultGallery)) 
			? _config.defaultGallery 
			: keys[0];
	}
	
	renderControls() {
		if (this.galleries.size <= 1) return;
		
		const controls = document.createElement('div');
		controls.className = 'gallery-controls';
		
		const buttonsContainer = document.createElement('div');
		buttonsContainer.className = 'gallery-buttons';
		buttonsContainer.role = 'tablist';
		
		this.galleries.forEach((gallery, key) => {
			const button = this.buttonTemplate.content.cloneNode(true).querySelector('button');
			button.dataset.gallery = key;
			button.textContent = gallery.name || key;
			button.classList.toggle('active', key === this.currentGallery);
			button.setAttribute('aria-selected', key === this.currentGallery);
			buttonsContainer.appendChild(button);
		});
		
		controls.appendChild(buttonsContainer);
		
		// Event delegation for button clicks
		controls.addEventListener('click', (e) => {
			const button = e.target.closest('.gallery-btn');
			if (!button?.dataset.gallery) return;
			
			this.switchGallery(button.dataset.gallery);
		});
		
		// Insert before first gallery grid
		const firstGrid = this.container.querySelector('.photo-grid');
		this.container.insertBefore(controls, firstGrid || this.container.firstElementChild);
	}
	
	switchGallery(galleryKey) {
		if (!this.galleries.has(galleryKey) || galleryKey === this.currentGallery) return;
		
		this.currentGallery = galleryKey;
		
		// Update button states
		this.container.querySelectorAll('.gallery-btn').forEach(btn => {
			const isActive = btn.dataset.gallery === galleryKey;
			btn.classList.toggle('active', isActive);
			btn.setAttribute('aria-selected', isActive);
		});
		
		// Render new gallery with transition
		this.renderGallery(this.galleries.get(galleryKey), true);
	}
	
	renderGallery(gallery, withTransition = false) {
		if (!gallery?.images?.length) return;
		
		const grids = this.createPhotoGrids(gallery.images);
		
		if (withTransition) {
			this.transitionGallery(grids);
		} else {
			// Remove old grids
			this.container.querySelectorAll('.photo-grid').forEach(g => g.remove());
			this.container.appendChild(grids);
		}
		
		// Invalidate modal's gallery cache when gallery changes
		this.photoModal?.invalidateGalleryCache?.();
	}
	
	createPhotoGrids(images) {
		const fragment = document.createDocumentFragment();
		const width = window.innerWidth;
		
		// Breakpoint logic
		let landscapeMax, portraitMax;
		if (width < 480) {
			landscapeMax = 3;
			portraitMax = 4;
		} else if (width < 768) {
			landscapeMax = 4;
			portraitMax = 5;
		} else if (width < 1024) {
			landscapeMax = 5;
			portraitMax = 6;
		} else {
			landscapeMax = 5;
			portraitMax = 7;
		}
		
		// Group by layout
		const landscape = images.filter(img => img.layout === 'landscape');
		const portrait = images.filter(img => img.layout === 'portrait');
		const pano = images.filter(img => img.layout === 'pano');
		
		// Create rows - simplified, no complex optimization
		const rows = [
			...this.createRows(landscape, 'landscape-row', landscapeMax),
			...this.createRows(portrait, 'portrait-row', portraitMax),
			...pano.map(img => ({ images: [img], rowClass: 'pano-row' }))
		];
		
		// Render rows
		rows.forEach(row => {
			fragment.appendChild(this.createGrid(row.images, row.rowClass));
		});
		
		return fragment;
	}
	
	createRows(images, rowClass, maxPerRow) {
		if (images.length === 0) return [];
		
		const rows = [];
		let i = 0;
		
		while (i < images.length) {
			const remaining = images.length - i;
			let rowSize = Math.min(maxPerRow, remaining);
			
			// Avoid orphan images
			if (remaining > maxPerRow && remaining <= maxPerRow + 1) {
				rowSize = Math.ceil(remaining / 2);
			}
			
			rows.push({
				images: images.slice(i, i + rowSize),
				rowClass
			});
			
			i += rowSize;
		}
		
		return rows;
	}
	
	createGrid(images, rowClass) {
		const row = document.createElement('div');
		row.className = `photo-grid ${rowClass}`;
		
		images.forEach(image => {
			const thumb = this.thumbTemplate.content.cloneNode(true);
			const img = thumb.querySelector('img');
			
			img.src = image.thumbnail || '';
			img.alt = image.alt || 'Untitled';
			img.dataset.sources = JSON.stringify(image.sources);
			img.dataset.title = image.title || image.alt || 'Untitled';
			if (image.id) img.dataset.filename = image.id;
			
			row.appendChild(thumb);
		});
		
		return row;
	}
	
	async transitionGallery(newGrids) {
		const oldGrids = this.container.querySelectorAll('.photo-grid');
		
		// Fade out old
		await Promise.all(Array.from(oldGrids).map(grid => {
			grid.style.transition = 'opacity 200ms';
			grid.style.opacity = '0';
			return new Promise(resolve => setTimeout(resolve, 200));
		}));
		
		// Remove old
		oldGrids.forEach(g => g.remove());
		
		// Add new (hidden)
		const newGridElements = Array.from(newGrids.children);
		newGridElements.forEach(g => g.style.opacity = '0');
		this.container.appendChild(newGrids);
		
		// Fade in new
		await Promise.all(newGridElements.map((grid, i) => {
			return new Promise(resolve => {
				setTimeout(() => {
					grid.style.transition = 'opacity 200ms';
					grid.style.opacity = '1';
					setTimeout(resolve, 200);
				}, i * 100);
			});
		}));
	}
	
	destroy() {
		this.galleries.clear();
	}
}

// Initialize
function initializeGalleries() {
	if (window.Galleries) window.Galleries.destroy();
	window.Galleries = new Galleries(window.photoModal);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeGalleries);
} else {
	initializeGalleries();
}

window.addEventListener('beforeunload', () => {
	window.Galleries?.destroy();
});