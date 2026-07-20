const POPOVER_TIMEOUT = 3000;

const RACK_ANIMATION = {
  closeDuration: 400,
  openDuration: 420,
  easing: 'cubic-bezier(.4, 0, .2, 1)',
};

/**
 * Navigation
 */
function initNavigation() {
  const wrapper = document.querySelector('.nav-wrapper');
  const menu = wrapper?.querySelector('nav');
  const toggle = wrapper?.querySelector('.nav-toggle');

  if (!wrapper || !menu || !toggle) return;

  const closeMenu = ({ restoreFocus = false } = {}) => {
	menu.classList.remove('is-open');
	toggle.setAttribute('aria-expanded', 'false');

	if (restoreFocus) {
	  toggle.focus();
	}
  };

  const updateScrollState = () => {
	wrapper.classList.toggle('nav-scrolled', scrollY > 10);
  };

  // Set the correct state before the user scrolls.
  updateScrollState();

  window.addEventListener('scroll', updateScrollState, {
	passive: true,
  });

  toggle.addEventListener('click', (event) => {
	event.stopPropagation();

	const isOpen = menu.classList.toggle('is-open');
	toggle.setAttribute('aria-expanded', String(isOpen));
  });

  menu.addEventListener('click', (event) => {
	if (
	  event.target instanceof Element &&
	  event.target.closest('a')
	) {
	  closeMenu();
	}
  });

  document.addEventListener('click', (event) => {
	if (
	  event.target instanceof Node &&
	  !wrapper.contains(event.target)
	) {
	  closeMenu();
	}
  });

  document.addEventListener('keydown', (event) => {
	if (
	  event.key === 'Escape' &&
	  menu.classList.contains('is-open')
	) {
	  closeMenu({ restoreFocus: true });
	}
  });
}

/**
 * Native popovers
 *
 * Opening, closing, focus handling, Escape, and light dismissal are
 * handled natively. This only adds the optional automatic timeout.
 */
function initPopoverTimeouts() {
  const timers = new WeakMap();

  document.addEventListener(
	'toggle',
	(event) => {
	  const popover = event.target;

	  if (
		!(popover instanceof HTMLElement) ||
		!popover.matches('[popover]')
	  ) {
		return;
	  }

	  const existingTimer = timers.get(popover);

	  if (existingTimer) {
		clearTimeout(existingTimer);
		timers.delete(popover);
	  }

	  if (event.newState !== 'open') return;

	  const timer = setTimeout(() => {
		if (popover.matches(':popover-open')) {
		  popover.hidePopover();
		}

		timers.delete(popover);
	  }, POPOVER_TIMEOUT);

	  timers.set(popover, timer);
	},
	true,
  );
}

/**
 * Copyright year
 */
function updateCopyrightYear() {
  const year = document.getElementById('copyright-year');

  if (year) {
	const currentYear = String(new Date().getFullYear());
	year.dateTime = currentYear;
	year.textContent = currentYear;
  }
}

/**
 * Animated details/channel rack
 */
function initChannelRacks() {
  const reduceMotion = matchMedia(
	'(prefers-reduced-motion: reduce)',
  ).matches;

  document
	.querySelectorAll('#skills details')
	.forEach((details) => {
	  initChannelRack(details, reduceMotion);
	});
}

function initChannelRack(details, reduceMotion) {
  const summary = details.querySelector('summary');
  const body = details.querySelector('article');

  if (!summary || !body) return;

  let animation = null;
  let isClosing = false;
  let isExpanding = false;

  if (reduceMotion) return;

  const animateHeight = (startHeight, endHeight, duration) => {
	animation?.cancel();

	animation = details.animate(
	  {
		height: [startHeight, endHeight],
	  },
	  {
		duration,
		easing: RACK_ANIMATION.easing,
	  },
	);

	return animation;
  };

  const finishAnimation = (shouldOpen) => {
	details.open = shouldOpen;

	animation = null;
	isClosing = false;
	isExpanding = false;

	details.style.height = '';
	details.style.overflow = '';
  };

  const shrinkRack = () => {
	isClosing = true;
	isExpanding = false;

	const startHeight = `${details.offsetHeight}px`;
	const endHeight = `${summary.offsetHeight}px`;

	const currentAnimation = animateHeight(
	  startHeight,
	  endHeight,
	  RACK_ANIMATION.closeDuration,
	);

	currentAnimation.addEventListener(
	  'finish',
	  () => finishAnimation(false),
	  { once: true },
	);

	currentAnimation.addEventListener(
	  'cancel',
	  () => {
		isClosing = false;
	  },
	  { once: true },
	);
  };

  const expandRack = () => {
	isExpanding = true;
	isClosing = false;

	const startHeight = `${details.offsetHeight}px`;
	const endHeight =
	  `${summary.offsetHeight + body.offsetHeight}px`;

	const currentAnimation = animateHeight(
	  startHeight,
	  endHeight,
	  RACK_ANIMATION.openDuration,
	);

	currentAnimation.addEventListener(
	  'finish',
	  () => finishAnimation(true),
	  { once: true },
	);

	currentAnimation.addEventListener(
	  'cancel',
	  () => {
		isExpanding = false;
	  },
	  { once: true },
	);

  };

  const openRack = () => {
	details.style.height = `${details.offsetHeight}px`;
	details.open = true;

	requestAnimationFrame(expandRack);
  };

  summary.addEventListener('click', (event) => {
	event.preventDefault();

	details.style.overflow = 'hidden';

	if (isClosing || !details.open) {
	  openRack();
	} else if (isExpanding || details.open) {
	  shrinkRack();
	}
  });
}

/**
 * Initialize
 */
export function initCandy() {
  initNavigation();
  initPopoverTimeouts();
  updateCopyrightYear();
  initChannelRacks();
}
