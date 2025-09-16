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
	  // Create a new tooltip element
	  const newTooltip = document.createElement('span');
	  newTooltip.textContent = title;
	  newTooltip.className = 'abbr-tooltip';
	  
	  const rect = this.getBoundingClientRect();
	  newTooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
	  newTooltip.style.left = `${rect.left + window.scrollX}px`;

	  document.body.appendChild(newTooltip);
	  activeTooltip = newTooltip;

	  // Trigger the fade-in
	  setTimeout(() => newTooltip.classList.add('show'), 10);

	  // Set the automatic fade-out timer
	  clearTimeout(timeoutId); // Clear any old timers just in case
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