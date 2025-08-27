class GallerySwapper {
  constructor() {
	this.galleries = {};
	this.currentGallery = 'default';
	this.init();
  }

  async init() {
	await this.loadGalleries();
	this.createGalleryButtons();
  }

  async loadGalleries() {
	try {
	  const response = await fetch('/json/galleries.json');
	  if (response.ok) {
		const data = await response.json();
		
		// Extract config if present
		const config = data._config || {};
		delete data._config;
		
		this.galleries = data;
		
		// Set default gallery from config, or use first available
		this.currentGallery = config.defaultGallery && this.galleries[config.defaultGallery] 
		  ? config.defaultGallery 
		  : Object.keys(this.galleries)[0];
		  
		// Load the default gallery immediately
		this.loadDefaultGallery();
	  } else {
		this.createDefaultGallery();
	  }
	} catch (error) {
	  console.error('Failed to load galleries:', error);
	  // Fallback to current images if JSON fails
	  this.createDefaultGallery();
	}
  }

  createDefaultGallery() {
	// Extract current images as default gallery
	const currentImages = [];
	document.querySelectorAll('.photo-thumb img').forEach(img => {
	  currentImages.push({
		src: img.src,
		alt: img.alt,
		title: img.dataset.title || img.alt
	  });
	});
	
	this.galleries = {
	  'mountains': {
		name: 'Mountain Adventures',
		images: currentImages
	  }
	};
	this.currentGallery = 'mountains';
  }

  loadDefaultGallery() {
	// Only load if there are no existing photo grids (avoid replacing HTML fallback)
	const existingGrids = document.querySelectorAll('.photo-grid');
	if (existingGrids.length === 0) {
	  const gallery = this.galleries[this.currentGallery];
	  if (gallery) {
		const gallerySection = document.querySelector('[aria-labelledby="gallery-heading"]');
		this.createPhotoGrids(gallery.images, gallerySection);
		
		// Initialize modal for the default gallery
		if (window.photoModal) {
		  window.photoModal.setupAspectRatios();
		  window.photoModal.setupPhotoClickHandlers();
		}
	  }
	}
  }

  createGalleryButtons() {
	const gallerySection = document.querySelector('[aria-labelledby="gallery-heading"]');
	if (!gallerySection) return;

	// Create button container
	const buttonContainer = document.createElement('div');
	buttonContainer.className = 'gallery-controls';
	buttonContainer.innerHTML = `
	  <div class="gallery-buttons" role="tablist" aria-label="Photo galleries">
		${Object.entries(this.galleries).map(([key, gallery]) => `
		  <button 
			type="button"
			class="gallery-btn ${key === this.currentGallery ? 'active' : ''}"
			data-gallery="${key}"
			role="tab"
			aria-selected="${key === this.currentGallery}"
		  >
			${gallery.name}
		  </button>
		`).join('')}
	  </div>
	`;

	// Insert before the first photo grid
	const firstGrid = gallerySection.querySelector('.photo-grid');
	gallerySection.insertBefore(buttonContainer, firstGrid);

	// Add event listeners
	buttonContainer.addEventListener('click', (e) => {
	  if (e.target.classList.contains('gallery-btn')) {
		this.switchGallery(e.target.dataset.gallery);
	  }
	});
  }

  switchGallery(galleryKey) {
	if (!this.galleries[galleryKey] || galleryKey === this.currentGallery) return;

	const gallery = this.galleries[galleryKey];
	this.currentGallery = galleryKey;

	// Update button states
	document.querySelectorAll('.gallery-btn').forEach(btn => {
	  const isActive = btn.dataset.gallery === galleryKey;
	  btn.classList.toggle('active', isActive);
	  btn.setAttribute('aria-selected', isActive);
	});

	const gallerySection = document.querySelector('[aria-labelledby="gallery-heading"]');
	const existingGrids = gallerySection.querySelectorAll('.photo-grid');

	// Fade out existing grids
	existingGrids.forEach(grid => {
	  grid.style.opacity = '0';
	  grid.style.transform = 'translateY(20px)';
	});

	// Wait for fade out, then replace content
	setTimeout(() => {
	  // Remove old grids
	  existingGrids.forEach(grid => grid.remove());
	  
	  // Create new photo grids
	  this.createPhotoGrids(gallery.images, gallerySection);
	  
	  // Fade in new grids
	  const newGrids = gallerySection.querySelectorAll('.photo-grid');
	  newGrids.forEach((grid, index) => {
		grid.style.opacity = '0';
		grid.style.transform = 'translateY(20px)';
		
		// Stagger the fade-in slightly
		setTimeout(() => {
		  grid.style.opacity = '1';
		  grid.style.transform = 'translateY(0)';
		}, index * 100);
	  });

	  // Reinitialize modal for new images
	  if (window.photoModal) {
		window.photoModal.setupAspectRatios();
		window.photoModal.setupPhotoClickHandlers();
	  }
	}, 300); // Match CSS transition duration
  }

  createPhotoGrids(images, container) {
	// Group images by aspect ratio for optimal layout
	const landscape = [];
	const portrait = [];
	const pano = [];

	images.forEach(image => {
	  // You can specify layout in the JSON or auto-detect
	  if (image.layout === 'pano') {
		pano.push(image);
	  } else if (image.layout === 'portrait') {
		portrait.push(image);
	  } else {
		landscape.push(image);
	  }
	});

	// Create landscape row
	if (landscape.length > 0) {
	  const landscapeRow = this.createPhotoRow('landscape-row', landscape.slice(0, 3));
	  container.appendChild(landscapeRow);
	}

	// Create pano rows
	pano.forEach(image => {
	  const panoRow = this.createPhotoRow('pano-row', [image]);
	  container.appendChild(panoRow);
	});

	// Create portrait row
	if (portrait.length > 0) {
	  const portraitRow = this.createPhotoRow('portrait-row', portrait.slice(0, 3));
	  container.appendChild(portraitRow);
	}
  }

  createPhotoRow(rowClass, images) {
	const row = document.createElement('div');
	row.className = `photo-grid ${rowClass}`;
	row.setAttribute('role', 'img');
	row.setAttribute('aria-label', 'Photography gallery');

	images.forEach(image => {
	  const thumb = document.createElement('div');
	  thumb.className = 'photo-thumb';
	  
	  // Create img element and set all necessary attributes
	  const imgElement = document.createElement('img');
	  imgElement.src = image.src;
	  imgElement.alt = image.alt;
	  imgElement.setAttribute('data-title', image.title);
	  //imgElement.setAttribute('loading', 'lazy');
	  
	  // Add any additional EXIF-related data if available
	  if (image.filename) {
		imgElement.setAttribute('data-filename', image.filename);
	  }
	  
	  thumb.appendChild(imgElement);
	  row.appendChild(thumb);
	});

	return row;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
	window.gallerySwapper = new GallerySwapper();
  });
} else {
  window.gallerySwapper = new GallerySwapper();
}