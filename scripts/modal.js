// Photo Modal and Aspect Ratio Handler
class PhotoModal {
  constructor() {
	this.exifData = {};
	this.currentIndex = 0;
	this.modal = null;
	this.modalImg = null;
	this.caption = null;
	this.closeBtn = null;
	
	this.init();
  }

  init() {
	this.createModal();
	this.setupEventListeners();
	this.setupAspectRatios();
	this.loadExifData();
  }

  createModal() {
	this.modal = document.createElement('div');
	this.modal.className = 'modal';
	this.modal.style.display = 'none';
	this.modal.innerHTML = `
	  <span class="modal-close">&times;</span>
	  <div class="modal-card">
		<img src="" alt="">
		<div class="modal-caption"></div>
	  </div>
	`;
	document.body.appendChild(this.modal);

	this.modalImg = this.modal.querySelector('img');
	this.caption = this.modal.querySelector('.modal-caption');
	this.closeBtn = this.modal.querySelector('.modal-close');
  }

  setupEventListeners() {
	this.closeBtn.addEventListener('click', () => this.closeModal());
	
	this.modal.addEventListener('click', (e) => {
	  if (e.target === this.modal) this.closeModal();
	});

	document.addEventListener('keydown', (e) => this.handleKeydown(e));
	this.setupPhotoClickHandlers();
  }

  setupPhotoClickHandlers() {
	// Photo thumbnail handlers
	document.querySelectorAll('.photo-thumb').forEach(thumb => {
	  thumb.addEventListener('click', () => {
		const img = thumb.querySelector('img');
		if (img) this.openModal(img, thumb);
	  });
	});

	// Camera button handlers (event delegation)
	document.addEventListener('click', (e) => {
	  if (e.target.classList.contains('camera-link')) {
		const imageUrl = e.target.dataset.image;
		
		if (imageUrl) {
		  const tempImg = new Image();
		  tempImg.src = imageUrl;
		  tempImg.alt = e.target.title || e.target.getAttribute('aria-label') || 'Camera Image';
		  
		  tempImg.onload = () => this.openModal(tempImg, e.target);
		  tempImg.onerror = () => this.openModal(tempImg, e.target);
		}
	  }
	});
  }

  setupAspectRatios() {
	document.querySelectorAll('.photo-thumb img').forEach(img => {
	  if (img.complete && img.naturalWidth) {
		this.classifyAspectRatio(img);
	  } else {
		img.addEventListener('load', () => this.classifyAspectRatio(img));
	  }
	});
  }

  classifyAspectRatio(img) {
	const ratio = img.naturalWidth / img.naturalHeight;
	const parent = img.parentElement;
	
	parent.classList.remove('pano', 'portrait', 'square', 'landscape');
	
	if (ratio > 2) {
	  parent.classList.add('pano');
	} else if (ratio < 0.8) {
	  parent.classList.add('portrait');
	} else if (Math.abs(ratio - 1) < 0.1) {
	  parent.classList.add('square');
	} else {
	  parent.classList.add('landscape');
	}
  }

  classifyModalAspectRatio(img) {
	const ratio = img.naturalWidth / img.naturalHeight;
	const modalCard = this.modal.querySelector('.modal-card');
	
	this.modal.classList.remove('pano', 'portrait', 'square', 'landscape');
	modalCard.classList.remove('modal-card--pano');
	
	if (ratio > 2) {
	  this.modal.classList.add('pano');
	  modalCard.classList.add('modal-card--pano');
	} else if (ratio < 0.8) {
	  this.modal.classList.add('portrait');
	} else if (Math.abs(ratio - 1) < 0.1) {
	  this.modal.classList.add('square');
	} else {
	  this.modal.classList.add('landscape');
	}
  }

  async loadExifData() {
	try {
	  const response = await fetch('/json/exif-data.json');
	  if (response.ok) {
		this.exifData = await response.json();
	  }
	} catch (error) {
	  // Silently fail - modal works without EXIF data
	}
  }

  openModal(img, thumbElement) {
	const allThumbImages = Array.from(document.querySelectorAll('.photo-thumb img'));
	this.currentIndex = allThumbImages.indexOf(img);
	const modalCard = this.modal.querySelector('.modal-card');
	
	this.modalImg.src = img.src;
	this.modalImg.alt = img.alt || "Untitled";

	// Handle aspect ratio classification
	if (thumbElement?.classList?.contains('photo-thumb')) {
	  // Use thumbnail's classification
	  this.modal.classList.toggle('pano', thumbElement.classList.contains('pano'));
	  this.modal.classList.toggle('portrait', thumbElement.classList.contains('portrait'));
	  this.modal.classList.toggle('square', thumbElement.classList.contains('square'));
	  this.modal.classList.toggle('landscape', thumbElement.classList.contains('landscape'));
	  
	  // Add modal card class for panos
	  modalCard.classList.toggle('modal-card--pano', thumbElement.classList.contains('pano'));
	} else {
	  // For button-triggered modals, classify based on image
	  if (img.complete && img.naturalWidth) {
		this.classifyModalAspectRatio(img);
	  } else {
		img.addEventListener('load', () => this.classifyModalAspectRatio(img), { once: true });
	  }
	}

	this.updateCaption(img, thumbElement);
	this.showModal();
  }

  updateCaption(img, sourceElement = null) {
	// Get title from multiple sources
	let title = "Untitled";
	
	if (sourceElement?.dataset?.title) {
	  title = sourceElement.dataset.title;
	} else if (img.dataset?.title) {
	  title = img.dataset.title;
	} else if (sourceElement?.title) {
	  title = sourceElement.title;
	} else if (sourceElement?.getAttribute('aria-label')) {
	  title = sourceElement.getAttribute('aria-label');
	} else if (img.alt && img.alt) {
	  title = img.alt;
	}
	
	const filename = img.src.split('/').pop();
	
	// Find EXIF data
	let photo = this.exifData[filename];
	if (!photo) {
	  const pathParts = img.src.split('/');
	  if (pathParts.length >= 2) {
		const subPath = pathParts.slice(-2).join('/');
		photo = this.exifData[subPath];
	  }
	}
	photo = photo || {};

	this.caption.innerHTML = `
	  <div class="caption-header">
		<time datetime="${this.formatExifDate(photo.date)}">${this.formatExifDate(photo.date)}</time>
		<h2 class="title">${title}</h2>
		${photo.gps ? `
		  <span class="gps">
			<a href="https://www.openstreetmap.org/?mlat=${photo.gps.lat}&mlon=${photo.gps.lon}&zoom=15" target="_blank">
			  ${photo.gps.lat.toFixed(5)}, ${photo.gps.lon.toFixed(5)}
			</a>
		  </span>` : ""}
	  </div>
	  <hr >
	  <span class="exif-row">
		${photo.iso ? `<span>ISO ${photo.iso}</span>` : ""} | 
		${photo.lens ? `<span>${photo.lens}</span>` : ""} | 
		${photo.aperture ? `<span><i>&#402;</i>${photo.aperture}</span>` : ""} | 
		${photo.shutter ? `<span>${photo.shutter}s</span>` : ""} | 
		${photo.format ? `<span class="format">${photo.format}</span>` : ""}
	  </span>
	`;
  }

  showModal() {
	this.modal.style.display = 'flex';
	requestAnimationFrame(() => {
	  this.modal.style.pointerEvents = 'auto';
	  this.modal.style.opacity = '1';
	});
  }

  closeModal() {
	this.modal.style.opacity = '0';
	this.modal.style.pointerEvents = 'none';
	
	const handleTransitionEnd = () => {
	  this.modal.style.display = 'none';
	  this.modal.removeEventListener('transitionend', handleTransitionEnd);
	};
	
	this.modal.addEventListener('transitionend', handleTransitionEnd);
  }

  handleKeydown(e) {
	if (this.modal.style.display !== 'flex') return;
	
	const allImages = Array.from(document.querySelectorAll('.photo-thumb img'));
	
	// Only allow navigation if opened from thumbnail
	if (this.currentIndex < 0 || this.currentIndex >= allImages.length) {
	  if (e.key === 'Escape') {
		e.preventDefault();
		this.closeModal();
	  }
	  return;
	}
	
	switch (e.key) {
	  case 'ArrowRight':
		e.preventDefault();
		const nextIndex = (this.currentIndex + 1) % allImages.length;
		this.openModal(allImages[nextIndex], allImages[nextIndex].parentElement);
		break;
	  case 'ArrowLeft':
		e.preventDefault();
		const prevIndex = (this.currentIndex - 1 + allImages.length) % allImages.length;
		this.openModal(allImages[prevIndex], allImages[prevIndex].parentElement);
		break;
	  case 'Escape':
		e.preventDefault();
		this.closeModal();
		break;
	}
  }

  formatExifDate(dateObj) {
	if (!dateObj) return "";
	const pad = n => String(n).padStart(2, "0");
	return `${dateObj.year}-${pad(dateObj.month)}-${pad(dateObj.day)}`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PhotoModal());
} else {
  new PhotoModal();
}