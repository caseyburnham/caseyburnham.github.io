// js/candy.js - Page initialization stuff
class TooltipManager {
	constructor() {
		this.activeTooltip = null;
		this.hideTimeout = null;
		this.init();
	}

	init() {
		document.addEventListener('click', (e) => {
			const abbr = e.target.closest('abbr');
			if (abbr) {
				e.preventDefault();
				e.stopPropagation();
				this.show(abbr.title, abbr);
			} else if (this.activeTooltip && !e.target.closest('.abbr-tooltip')) {
				this.hide();
			}
		});
	}

	show(content, anchor) {
		this.hide();
		
		const tooltip = document.createElement('span');
		tooltip.className = 'abbr-tooltip';
		tooltip.textContent = content;
		document.body.appendChild(tooltip);

		const rect = anchor.getBoundingClientRect();
		tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
		tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;
		
		requestAnimationFrame(() => tooltip.classList.add('show'));
		
		this.activeTooltip = tooltip;
		this.hideTimeout = setTimeout(() => this.hide(), 3000);
	}

	hide() {
		if (!this.activeTooltip) return;
		
		clearTimeout(this.hideTimeout);
		this.activeTooltip.classList.remove('show');
		
		setTimeout(() => {
			this.activeTooltip?.remove();
			this.activeTooltip = null;
		}, 500);
	}
}

class Navigation {
	constructor() {
		const nav = document.querySelector('.nav-wrapper');
		const menu = document.querySelector('nav');
		const hamburger = document.querySelector('.nav-wrapper button');
		
		if (!nav || !menu || !hamburger) return;

		window.addEventListener('scroll', () => {
			nav.classList.toggle('nav-scrolled', window.scrollY > 10);
		});

		hamburger.addEventListener('click', (e) => {
			e.stopPropagation();
			menu.classList.toggle('is-open');
		});

		menu.addEventListener('click', (e) => {
			if (e.target.closest('a')) {
				menu.classList.remove('is-open');
			}
		});

		document.addEventListener('click', (e) => {
			if (!menu.contains(e.target) && !hamburger.contains(e.target)) {
				menu.classList.remove('is-open');
			}
		});
	}
}

// Initialize everything on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
	new TooltipManager();
	new Navigation();
	
	// Copyright year
	const yearEl = document.getElementById('year');
	if (yearEl) yearEl.textContent = new Date().getFullYear();

});