// const sections = document.querySelectorAll('.fade-in');
// 
// const observerOptions = {
// threshold: 0,
// rootMargin: '0px 0px -10px 0px'
// };
// 
// const observer = new IntersectionObserver((entries) => {
// entries.forEach((entry, index) => {
// 	if (entry.isIntersecting) {
// 		setTimeout(() => {
// 			entry.target.classList.add('is-visible');
// 		}, index * 150);
// 		observer.unobserve(entry.target);
// 	}
// });
// }, observerOptions);
// 
// sections.forEach(section => observer.observe(section));

// class Navigation {
	// constructor() {
	// 	const nav = document.querySelector('nav');
	// 	const menu = nav?.querySelector('ul');
	// 	const hamburger = nav?.querySelector('button');
	// 	if (!nav || !menu || !hamburger) return;
	// 	this.nav = nav;
	// 	this.menu = menu;
	// 	this.hamburger = hamburger;
	// 	this.initializeAria();
	// 	window.addEventListener('scroll', () => {
	// 		nav.classList.toggle('nav-scrolled', window.scrollY > 10);
	// 	});
	// 	
	// 	// Hamburger click
	// 	hamburger.addEventListener('click', (e) => {
	// 		e.stopPropagation();
	// 		this.toggleMenu();
	// 	});
	// 	
	// 	// Nav click (new)
	// 	nav.addEventListener('click', (e) => {
	// 		// Only toggle if clicking the nav itself, not the menu or hamburger
	// 		if (e.target === nav) {
	// 			e.stopPropagation();
	// 			this.toggleMenu();
	// 		}
	// 	});
	// 	
	// 	menu.addEventListener('click', (e) => {
	// 		if (e.target.closest('a')) {
	// 			this.closeMenu();
	// 		}
	// 	});
	// 	
	// 	document.addEventListener('click', (e) => {
	// 		if (!nav.contains(e.target)) {
	// 			this.closeMenu();
	// 		}
	// 	});
	// 	
	// 	document.addEventListener('keydown', (e) => {
	// 		if (e.key === 'Escape' && menu.classList.contains('is-open')) {
	// 			this.closeMenu();
	// 			hamburger.focus();
	// 		}
	// 	});
	// }
	// initializeAria() {
	// 	if (!this.menu.id) {
	// 		this.menu.id = 'nav-menu';
	// 	}
	// 	this.hamburger.setAttribute('aria-controls', this.menu.id);
	// 	this.hamburger.setAttribute('aria-expanded', 'false');
	// 	if (!this.hamburger.getAttribute('aria-label')) {
	// 		this.hamburger.setAttribute('aria-label', 'Toggle navigation menu');
	// 	}
	// }
	// toggleMenu() {
	// 	const isOpen = this.menu.classList.toggle('is-open');
	// 	this.hamburger.setAttribute('aria-expanded', isOpen.toString());
	// 	if (isOpen) {
	// 		this.trapFocus();
	// 	}
	// }
	// closeMenu() {
	// 	this.menu.classList.remove('is-open');
	// 	this.hamburger.setAttribute('aria-expanded', 'false');
	// }
	// openMenu() {
	// 	this.menu.classList.add('is-open');
	// 	this.hamburger.setAttribute('aria-expanded', 'true');
	// 	this.trapFocus();
	// }
	// trapFocus() {
	// 	const focusableElements = this.menu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
	// 	if (focusableElements.length === 0) return;
	// 	const firstElement = focusableElements[0];
	// 	const lastElement = focusableElements[focusableElements.length - 1];
	// 	firstElement.focus();
	// 	const handleTab = (e) => {
	// 		if (e.key !== 'Tab') return;
	// 		if (e.shiftKey) {
	// 			if (document.activeElement === firstElement) {
	// 				e.preventDefault();
	// 				lastElement.focus();
	// 			}
	// 		}
	// 
	// 		else {
	// 			if (document.activeElement === lastElement) {
	// 				e.preventDefault();
	// 				firstElement.focus();
	// 			}
	// 		}
	// 	};
	// 	this.menu.addEventListener('keydown', handleTab);
	// 	const cleanup = () => {
	// 		if (!this.menu.classList.contains('is-open')) {
	// 			this.menu.removeEventListener('keydown', handleTab);
	// 			document.removeEventListener('click', cleanup);
	// 		}
	// 	};
	// 	setTimeout(() => {
	// 		document.addEventListener('click', cleanup);
	// 	}, 100);
	// }
// }
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

document.querySelectorAll('abbr[data-popover]')
  .forEach(abbr => {
	const popover = document.getElementById(abbr.dataset.popover);
	let closeTimeout;

	abbr.addEventListener('click', (e) => {
	  e.preventDefault();
	  clearTimeout(closeTimeout);

	  if (popover.matches(':popover-open')) {
		popover.hidePopover();
		return;
	  }

	  popover.showPopover();
	  closeTimeout = setTimeout(() => popover.hidePopover(), 3000);
	});
  });
document.addEventListener('DOMContentLoaded', () => {
	new Navigation();
	const yearEl = document.getElementById('year');
	if (yearEl) yearEl.textContent = new Date()
		.getFullYear();
});