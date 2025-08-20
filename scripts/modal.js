// Photo Modal and Aspect Ratio Handler
class PhotoModal {
  constructor() {
	this.exifData = {};
	this.currentIndex = 0;
	this.modal = null;
	this.modalImg = null;
	this.caption = null;
	
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
	// Close button
	this.closeBtn.addEventListener('click', () => this.closeModal());
	
	// Click outside modal
	this.modal.addEventListener('click', (e) => {
	  if (e.target === this.modal) this.closeModal();
	});

	// Keyboard navigation
	document.addEventListener('keydown', (e) => this.handleKeydown(e));

	// Photo click handlers - set up immediately
	this.setupPhotoClickHandlers();
  }

  setupPhotoClickHandlers() {
	document.querySelectorAll('.photo-thumb').forEach(thumb => {
	  thumb.addEventListener('click', () => {
		const img = thumb.querySelector('img');
		if (img) this.openModal(img, thumb);
	  });
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
	
	// Remove existing aspect classes
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

  async loadExifData() {
	try {
	  const response = await fetch('/json/exif-data.json');
	  if (response.ok) {
		this.exifData = await response.json();
	  }
	} catch (error) {
	  console.warn('Could not load EXIF data:', error);
	  // Modal still works without EXIF data
	}
  }

  openModal(img, thumbElement) {
	const allImages = Array.from(document.querySelectorAll('.photo-thumb img'));
	this.currentIndex = allImages.indexOf(img);

	this.modalImg.src = img.src;
	this.modalImg.alt = img.alt || "Untitled";

	// Toggle pano class based on thumbnail
	this.modal.classList.toggle('pano', thumbElement?.classList.contains('pano'));

	this.updateCaption(img);
	this.showModal();
  }

  updateCaption(img) {
	const title = img.alt || "Untitled";
	const filename = img.src.split('/').pop();
	const photo = this.exifData[filename] || {};

	this.caption.innerHTML = `
	  <div class="caption-header inline">
		<span class="date">${this.formatExifDate(photo.date)}</span>
		<h2 class="title">${title}</h2>
		${photo.gps ? `
		  <span class="gps">
			<a href="https://www.openstreetmap.org/?mlat=${photo.gps.lat}&mlon=${photo.gps.lon}&zoom=15" target="_blank">
			  ${photo.gps.lat.toFixed(5)}, ${photo.gps.lon.toFixed(5)}
			</a>
		  </span>` : ""}
	  </div>
	  
	  <small class="exif-row">
		${photo.iso ? `<span>ISO ${photo.iso}</span>` : ""}
		${photo.lens ? `<span>${photo.lens}</span>` : ""}
		${photo.aperture ? `<span><i>&#402;</i>${photo.aperture}</span>` : ""}
		${photo.shutter ? `<span>${photo.shutter}s</span>` : ""}
		${photo.format ? `<span class="format">${photo.format}</span>` : ""}
	  </small>
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
	return `${pad(dateObj.month)}-${pad(dateObj.day)}-${dateObj.year}`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PhotoModal());
} else {
  new PhotoModal();
}