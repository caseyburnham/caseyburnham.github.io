const GALLERY_MENU_CLOSE_DELAY = 180;
/**
 * Navigation
 */
function initNavigation() {
	const wrapper = document.querySelector('.nav-wrapper');
	const menu = wrapper?.querySelector('nav');
	const toggle = wrapper?.querySelector('button[aria-controls="nav-main"]');
	if (!wrapper || !menu || !toggle) return;
	toggle.setAttribute('aria-expanded', 'false');
	const links = [...menu.querySelectorAll(':scope > ul > li > a[href^="#"]')];
	links.forEach((link, index) => link.parentElement.style.setProperty('--i', index));
	const galleryLink = menu.querySelector(':scope > ul > li > a[href="#galleries"]');
	const galleryItem = galleryLink?.parentElement;
	let galleryCloseTimer;
	const defaultGallery = document.getElementById('galleries').dataset.gallery;
	const sections = links.map((link) => {
		const id = link.hash.slice(1);
		const section = document.getElementById(id);
		return section ? {
			link,
			section,
		} : null;
	}).filter(Boolean);
	const setCurrentSection = (current) => {
		const currentTop = current?.section.getBoundingClientRect().top;
		const sharedTableIds = ['mountains', 'concerts'];
		const sharesTableState = sharedTableIds.includes(current?.section.id);
		for (const {
			link,
			section
		} of sections) {
			const isCurrent = link === current?.link;
			const sharesCurrentRow = (currentTop !== undefined
				&& Math.abs(section.getBoundingClientRect().top - currentTop) < 1)
				|| (sharesTableState && sharedTableIds.includes(section.id));
			link.classList.toggle('is-current-section', sharesCurrentRow);
			if (isCurrent) {
				link.setAttribute('aria-current', 'location');
			}
			else {
				link.removeAttribute('aria-current');
			}
		}
	};
	const updateCurrentSection = () => {
		const scrollPaddingTop = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
		const sectionThreshold = scrollPaddingTop + 1;
		const current = sections.findLast(({
			section
		}) => section.getBoundingClientRect().top <= sectionThreshold) ?? sections[0];
		setCurrentSection(current);
	};
	const updateCurrentSectionFromHash = () => {
		const id = location.hash.slice(1).split('?')[0];
		const current = sections.find(({
			section
		}) => section.id === id);
		if (current) {
			setCurrentSection(current);
		}
	};
	const closeMenu = ({
		restoreFocus = false
	} = {}) => {
		toggle.setAttribute('aria-expanded', 'false');
		if (restoreFocus) {
			toggle.focus();
		}
	};
	const getRouteGallery = () => {
		const [section, query = ''] = location.hash.slice(1).split('?');
		if (section !== 'galleries') return null;
		return new URLSearchParams(query).get('gallery') || defaultGallery;
	};
	const updateGalleryLinkState = (gallery = getRouteGallery()) => {
		menu.querySelectorAll('.gallery-navigation a[data-gallery]')
			.forEach(link => link.classList.toggle('is-selected-gallery', link.dataset.gallery === gallery));
	};
	updateGalleryLinkState();
	const openGalleryMenu = () => {
		clearTimeout(galleryCloseTimer);
		const galleryPanel = galleryItem?.querySelector('.gallery-navigation');
		if (!galleryItem?.matches(':hover, :focus-within') || !galleryPanel || getComputedStyle(galleryPanel).display === 'none') return;
		galleryLink?.setAttribute('aria-expanded', 'true');
	};
	const closeGalleryMenu = ({
		restoreFocus = false
	} = {}) => {
		clearTimeout(galleryCloseTimer);
		galleryLink?.setAttribute('aria-expanded', 'false');
		if (restoreFocus) galleryLink?.focus();
	};
	const scheduleGalleryMenuClose = () => {
		clearTimeout(galleryCloseTimer);
		galleryCloseTimer = setTimeout(() => closeGalleryMenu(), GALLERY_MENU_CLOSE_DELAY);
	};
	galleryItem?.addEventListener('pointerenter', openGalleryMenu);
	galleryItem?.addEventListener('pointerleave', scheduleGalleryMenuClose);
	galleryItem?.addEventListener('focusin', openGalleryMenu);
	galleryItem?.addEventListener('focusout', event => {
		if (!(event.relatedTarget instanceof Node) || !galleryItem.contains(event.relatedTarget)) {
			scheduleGalleryMenuClose();
		}
	});
	const updateScrollState = () => {
		wrapper.classList.toggle('nav-scrolled', scrollY > 10);
		updateCurrentSection();
	};
	// Set the correct state before the user scrolls.
	updateScrollState();
	window.addEventListener('scroll', updateScrollState, {
		passive: true,
	});
	window.addEventListener('resize', updateCurrentSection, {
		passive: true,
	});
	window.addEventListener('hashchange', updateCurrentSectionFromHash);
	toggle.addEventListener('click', (event) => {
		event.stopPropagation();
		const isOpen = toggle.getAttribute('aria-expanded') !== 'true';
		toggle.setAttribute('aria-expanded', String(isOpen));
	});
	menu.addEventListener('click', (event) => {
		if (event.target instanceof Element) {
			const link = event.target.closest('a');
			if (!link) return;
			const targetId = link.hash.slice(1).split('?')[0];
			const current = sections.find(({ section }) => section.id === targetId);
			setCurrentSection(current);
			if (link.dataset.gallery) {
				updateGalleryLinkState(link.dataset.gallery);
				requestAnimationFrame(() => current?.section.scrollIntoView({
					block: 'start'
				}));
			}
			closeGalleryMenu();
			closeMenu();
		}
	});
	document.addEventListener('click', (event) => {
		if (event.target instanceof Node && !wrapper.contains(event.target)) {
			closeGalleryMenu();
			closeMenu();
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && galleryLink?.getAttribute('aria-expanded') === 'true') {
			closeGalleryMenu({
				restoreFocus: true
			});
			return;
		}
		if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
			closeMenu({
				restoreFocus: true
			});
		}
	});
	window.addEventListener('hashchange', () => updateGalleryLinkState());
	document.addEventListener('gallerychange', event => {
		updateGalleryLinkState(event.detail?.gallery);
	});
}
/**
 * Copyright year
 */
function updateCopyrightYear() {
	const year = document.getElementById('copyright-year');
	if (year) {
		const currentYear = String(new Date()
			.getFullYear());
		year.dateTime = currentYear;
		year.textContent = currentYear;
	}
}
/**
 * Portrait
 *
 * The framed photo keeps its tilted position after the first pointer hover.
 */
function initPortraitTilt() {
	const portrait = document.querySelector('#about .portrait');
	portrait?.addEventListener('pointerenter',
		() => portrait.classList.add('is-tilted'), {
			once: true
		}, );
}
/**
 * Initialize
 */
export function initCandy() {
	initNavigation();
	updateCopyrightYear();
	initPortraitTilt();
}
