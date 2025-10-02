//Tooltip
let activeTooltip = null;
let timeoutId = null;
const fadeOutDuration = 500; // This must match your CSS transition time in milliseconds
const autoHideDelay = 3000; // 3 seconds before auto-hiding

function hideTooltip() {
  if (activeTooltip) {
	activeTooltip.classList.remove('show');
	timeoutId = setTimeout(() => {
	  if (activeTooltip) {
		activeTooltip.remove();
		activeTooltip = null;
	  }
	}, fadeOutDuration);
  }
}

document.querySelectorAll('abbr').forEach(abbr => {
  abbr.addEventListener('click', function(event) {
	event.preventDefault();
	event.stopPropagation();

	const title = this.getAttribute('title');

	// If a tooltip is already visible, clear the existing timer and hide it immediately
	if (activeTooltip) {
	  clearTimeout(timeoutId);
	  hideTooltip();
	}

	if (title) {
	  const newTooltip = document.createElement('span');
	  newTooltip.textContent = title;
	  newTooltip.className = 'abbr-tooltip';
	  document.body.appendChild(newTooltip); // append first so we can measure size
	
	  const rect = this.getBoundingClientRect();
	  const tooltipRect = newTooltip.getBoundingClientRect();
	
	  newTooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
	  newTooltip.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2)}px`;
	
	  activeTooltip = newTooltip;
	
	  setTimeout(() => newTooltip.classList.add('show'), 10);
	
	  clearTimeout(timeoutId);
	  timeoutId = setTimeout(() => {
		hideTooltip();
	  }, autoHideDelay);
	}
  });
});

document.addEventListener('click', function(event) {
  if (activeTooltip && !event.target.closest('abbr')) {
	clearTimeout(timeoutId);
	hideTooltip();
  }
});

//Copyright Year
document.getElementById("year").textContent = new Date().getFullYear();

		// Select the navigation wrapper element
const navWrapper = document.querySelector('.nav-wrapper');
const hamburgerBtn = document.querySelector('.hamburger-btn');

//Nav Shadows
function handleScroll() {
	// Check if the user has scrolled more than 10 pixels from the top
	if (window.scrollY > 10) {
		// If so, add the 'nav-scrolled' class
		navWrapper.classList.add('nav-scrolled');
		// hamburgerBtn.classList.add('nav-scrolled');
	} else {
		// Otherwise, remove it
		navWrapper.classList.remove('nav-scrolled');
		// hamburgerBtn.classList.remove('nav-scrolled');
	}
}

// Listen for the scroll event on the window
window.addEventListener('scroll', handleScroll);

//ham
document.addEventListener('DOMContentLoaded', () => {
	const hamburgerBtn = document.querySelector('.hamburger-btn');
	const navMenu = document.querySelector('.sticky-nav');

	// Toggle the menu when the hamburger button is clicked
	hamburgerBtn.addEventListener('click', (event) => {
		// Prevent the click on the button from immediately triggering the document listener
		event.stopPropagation();
		navMenu.classList.toggle('is-open');
	});

	// Close the menu when a link is clicked
	const navLinks = document.querySelectorAll('.sticky-nav a');
	navLinks.forEach(link => {
		link.addEventListener('click', () => {
			navMenu.classList.remove('is-open');
		});
	});

	// Close the menu when a click occurs anywhere on the document
	document.addEventListener('click', (event) => {
		// Check if the menu is open and if the clicked target is outside the menu
		const isClickInsideNav = navMenu.contains(event.target);
		const isClickInsideBtn = hamburgerBtn.contains(event.target);

		if (!isClickInsideNav && !isClickInsideBtn) {
			navMenu.classList.remove('is-open');
		}
	});
});