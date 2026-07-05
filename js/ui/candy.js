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

class Navigation {
	constructor() {
		const nav = document.querySelector('.nav-wrapper');
		const menu = document.querySelector('nav');
		const hamburger = document.querySelector('.nav-wrapper button');
		const closeMenu = () => {
			menu.classList.remove('is-open');
			hamburger.setAttribute('aria-expanded', 'false');
		};
		
		if (!nav || !menu || !hamburger) return;

		window.addEventListener('scroll', () => {
			nav.classList.toggle('nav-scrolled', window.scrollY > 10);
		});

hamburger.addEventListener('click', (e) => {
			e.stopPropagation();
			const isOpen = menu.classList.toggle('is-open');
			hamburger.setAttribute('aria-expanded', isOpen);
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