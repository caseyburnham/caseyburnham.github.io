// ===== Tooltip Module =====
class TooltipManager {
  constructor(fadeOutDuration = 500, autoHideDelay = 3000) {
	this.activeTooltip = null;
	this.timeoutId = null;
	this.fadeOutDuration = fadeOutDuration;
	this.autoHideDelay = autoHideDelay;
	this.init();
  }

  init() {
	document.querySelectorAll('abbr').forEach(abbr => {
	  abbr.addEventListener('click', (e) => this.handleAbbrClick(e, abbr));
	});

	document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  handleAbbrClick(event, element) {
	event.preventDefault();
	event.stopPropagation();

	const title = element.getAttribute('title');
	
	if (this.activeTooltip) {
	  clearTimeout(this.timeoutId);
	  this.hide();
	}

	if (title) {
	  this.show(title, element);
	}
  }

  show(content, anchorElement) {
	const tooltip = this.createTooltip(content);
	document.body.appendChild(tooltip);
	
	this.positionTooltip(tooltip, anchorElement);
	this.activeTooltip = tooltip;
	
	requestAnimationFrame(() => {
	  tooltip.classList.add('show');
	});

	this.scheduleAutoHide();
  }

  createTooltip(content) {
	const tooltip = document.createElement('span');
	tooltip.textContent = content;
	tooltip.className = 'abbr-tooltip';
	return tooltip;
  }

  positionTooltip(tooltip, anchorElement) {
	const anchorRect = anchorElement.getBoundingClientRect();
	const tooltipRect = tooltip.getBoundingClientRect();
	
	tooltip.style.top = `${anchorRect.bottom + window.scrollY + 5}px`;
	tooltip.style.left = `${anchorRect.left + window.scrollX + (anchorRect.width / 2) - (tooltipRect.width / 2)}px`;
  }

  scheduleAutoHide() {
	clearTimeout(this.timeoutId);
	this.timeoutId = setTimeout(() => this.hide(), this.autoHideDelay);
  }

  hide() {
	if (!this.activeTooltip) return;

	this.activeTooltip.classList.remove('show');
	
	this.timeoutId = setTimeout(() => {
	  if (this.activeTooltip) {
		this.activeTooltip.remove();
		this.activeTooltip = null;
	  }
	}, this.fadeOutDuration);
  }

  handleDocumentClick(event) {
	if (this.activeTooltip && !event.target.closest('abbr')) {
	  clearTimeout(this.timeoutId);
	  this.hide();
	}
  }
}

// ===== Navigation Module =====
class NavigationManager {
  constructor() {
	this.navWrapper = document.querySelector('.nav-wrapper');
	this.hamburgerBtn = document.querySelector('.nav-wrapper button');
	this.navMenu = document.querySelector('nav');
	this.scrollThreshold = 10;
	this.init();
  }

  init() {
	this.setupScrollHandler();
	this.setupHamburgerMenu();
  }

  setupScrollHandler() {
	window.addEventListener('scroll', () => this.handleScroll());
  }

  handleScroll() {
	const shouldAddShadow = window.scrollY > this.scrollThreshold;
	this.navWrapper.classList.toggle('nav-scrolled', shouldAddShadow);
  }

  setupHamburgerMenu() {
	this.hamburgerBtn.addEventListener('click', (e) => this.toggleMenu(e));
	
	this.setupNavLinks();
	this.setupOutsideClickHandler();
  }

  toggleMenu(event) {
	event.stopPropagation();
	this.navMenu.classList.toggle('is-open');
  }

  setupNavLinks() {
	const navLinks = this.navMenu.querySelectorAll('a');
	navLinks.forEach(link => {
	  link.addEventListener('click', () => this.closeMenu());
	});
  }

  setupOutsideClickHandler() {
	document.addEventListener('click', (e) => {
	  const isClickInsideNav = this.navMenu.contains(e.target);
	  const isClickInsideBtn = this.hamburgerBtn.contains(e.target);

	  if (!isClickInsideNav && !isClickInsideBtn) {
		this.closeMenu();
	  }
	});
  }

  closeMenu() {
	this.navMenu.classList.remove('is-open');
  }
}

// ===== Record Z-indexer =====
export default class AlbumHoverManager {
  constructor(selector) {
	this.albums = document.querySelectorAll(selector);
	
	this.currentZIndex = 10;
	
	this.handleMouseEnter = this.handleMouseEnter.bind(this);
	this.handleMouseLeave = this.handleMouseLeave.bind(this);
	this.handleTransitionEnd = this.handleTransitionEnd.bind(this);
	this.init();
  }

  init() {
	this.albums.forEach(album => {
	  album.addEventListener('mouseenter', this.handleMouseEnter);
	  album.addEventListener('mouseleave', this.handleMouseLeave);
	});
  }

  handleMouseEnter(event) {
	const album = event.currentTarget;
	const parent = album.closest('.discogs-record');
	
	album.classList.remove('is-leaving');
	album.classList.add('is-active');
	
	if (parent) {
	  parent.classList.remove('is-leaving');
	  parent.classList.add('is-active');
	  // Assign incrementing z-index
	  parent.style.zIndex = this.currentZIndex++;
	}
  }

  handleMouseLeave(event) {
	const album = event.currentTarget;
	const parent = album.closest('.discogs-record');
	
	album.classList.remove('is-active');
	album.classList.add('is-leaving');
	
	if (parent) {
	  parent.classList.remove('is-active');
	  parent.classList.add('is-leaving');
	}
	
	album.addEventListener('transitionend', this.handleTransitionEnd, { once: true });
  }

  handleTransitionEnd(event) {
	if (event.propertyName === 'transform') {
	  const album = event.currentTarget;
	  const parent = album.closest('.discogs-record');
	  
	  album.classList.remove('is-leaving');
	  
	  if (parent) {
		parent.classList.remove('is-leaving');
		// Reset to base z-index after transition
		parent.style.zIndex = '';
	  }
	}
  }
};

// ===== Utility Functions =====
// Copyright Year
const updateCopyrightYear = () => {
  const yearElement = document.getElementById('year');
  if (yearElement) {
	yearElement.textContent = new Date().getFullYear();
  }
};

// ===== Application Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  new TooltipManager();
  new NavigationManager();
  updateCopyrightYear();
});