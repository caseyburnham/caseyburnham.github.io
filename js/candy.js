// ===== Tooltip Module =====
let tooltipManagerInstance;

class TooltipManager {
	constructor(fadeOutDuration = 500, autoHideDelay = 3000) {
		this.activeTooltip = null;
		this.timeoutId = null;
		this.fadeOutDuration = fadeOutDuration;
		this.autoHideDelay = autoHideDelay;

		this.handleAbbrClick = this.handleAbbrClick.bind(this);
		this.handleDocumentClick = this.handleDocumentClick.bind(this);

		this.init();
	}

	init() {
		this.removeListeners();

		document.querySelectorAll('abbr')
			.forEach(abbr => {
				abbr.addEventListener('click', this.handleAbbrClick);
			});

		if (!this.documentClickListenerAttached) {
			document.addEventListener('click', this.handleDocumentClick);
			this.documentClickListenerAttached = true;
		}
	}

	removeListeners() {
		document.querySelectorAll('abbr')
			.forEach(abbr => {
				abbr.removeEventListener('click', this.handleAbbrClick);
			});
	}

	handleAbbrClick(event) {
		const element = event.currentTarget;
		
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

		requestAnimationFrame(() => {
			const tooltipRect = tooltip.getBoundingClientRect();
			const top = anchorRect.bottom + window.scrollY + 5;
			const left = anchorRect.left + window.scrollX + (anchorRect.width / 2) - (tooltipRect.width / 2);

			tooltip.style.top = `${top}px`;
			tooltip.style.left = `${left}px`;
		});
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

	destroy() {
		clearTimeout(this.timeoutId);
		this.hide();
		this.removeListeners();
		if (this.documentClickListenerAttached) {
			document.removeEventListener('click', this.handleDocumentClick);
			this.documentClickListenerAttached = false;
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
		this.abortController = new AbortController();
		
		if (!this.navWrapper || !this.hamburgerBtn || !this.navMenu) {
			console.warn('Navigation elements not found');
			return;
		}
		
		this.init();
	}

	init() {
		try {
			this.setupScrollHandler();
			this.setupHamburgerMenu();
		} catch (error) {
			console.error('Navigation initialization failed:', error);
		}
	}

	setupScrollHandler() {
		window.addEventListener('scroll', () => this.handleScroll(), {
			signal: this.abortController.signal
		});
	}

	handleScroll() {
		try {
			const shouldAddShadow = window.scrollY > this.scrollThreshold;
			this.navWrapper.classList.toggle('nav-scrolled', shouldAddShadow);
		} catch (error) {
			console.error('Error handling scroll:', error);
		}
	}

	setupHamburgerMenu() {
		this.hamburgerBtn.addEventListener('click', (e) => this.toggleMenu(e), {
			signal: this.abortController.signal
		});
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
			link.addEventListener('click', () => this.closeMenu(), {
				signal: this.abortController.signal
			});
		});
	}

	setupOutsideClickHandler() {
		document.addEventListener('click', (e) => {
			const isClickInsideNav = this.navMenu.contains(e.target);
			const isClickInsideBtn = this.hamburgerBtn.contains(e.target);

			if (!isClickInsideNav && !isClickInsideBtn) {
				this.closeMenu();
			}
		}, {
			signal: this.abortController.signal
		});
	}

	closeMenu() {
		this.navMenu.classList.remove('is-open');
	}

	destroy() {
		this.abortController?.abort();
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
				parent.style.zIndex = '';
			}
		}
	}
}

// ===== Utility Functions =====
const abbrMap = {
	"Arvada Center": "ACAH",
	"Aurora Fox Arts Center": "AFAC",
	"Town Hall Arts Center": "THAC",
	"Sangre de Cristo": "SdC"
};

function createAbbrHTML(fullText, abbrText) {
	const escapedText = fullText.replace(/"/g, '&quot;');
	return `<abbr title="${escapedText}">${abbrText}</abbr>`;
}

function toggleAbbreviations(apply) {
	try {
		const tables = document.querySelectorAll('.js-abbr');

		tables.forEach(table => {
			const cells = table.querySelectorAll('td');

			cells.forEach(cell => {
				const originalText = cell.getAttribute('data-original-text') || cell.textContent.trim();

				if (!cell.hasAttribute('data-original-text')) {
					cell.setAttribute('data-original-text', originalText);
				}

				const matchKey = Object.keys(abbrMap)
					.find(key =>
						key.toLowerCase()
						.trim() === originalText.toLowerCase()
					);

				if (matchKey) {
					if (apply) {
						const abbrText = abbrMap[matchKey];
						cell.innerHTML = createAbbrHTML(matchKey, abbrText);
					} else {
						cell.innerHTML = originalText;
					}
				}
			});
		});

		if (apply && tooltipManagerInstance) {
			tooltipManagerInstance.init();
		}
	} catch (error) {
		console.error('Error toggling abbreviations:', error);
	}
}

// Media Query Listener
const narrowScreenQuery = window.matchMedia("(max-width: 600px)");

function handleScreenChange(event) {
	toggleAbbreviations(event.matches);
}

handleScreenChange(narrowScreenQuery);

narrowScreenQuery.addListener(handleScreenChange);

// Copyright Year
const updateCopyrightYear = () => {
	try {
		const yearElement = document.getElementById('year');
		if (yearElement) {
			yearElement.textContent = new Date().getFullYear();
		}
	} catch (error) {
		console.error('Error updating copyright year:', error);
	}
};

// ===== Application Initialization =====
document.addEventListener('DOMContentLoaded', () => {
	try {
		tooltipManagerInstance = new TooltipManager();
		window.navigationManager = new NavigationManager();
		updateCopyrightYear();
	} catch (error) {
		console.error('Candy.js initialization failed:', error);
	}
});

// Cleanup
window.addEventListener('beforeunload', () => {
	window.navigationManager?.destroy();
	tooltipManagerInstance?.destroy();
});