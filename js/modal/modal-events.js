/**
 * Separated file for event listener management.
 * @file modal-events.js
 */
export const setupEventListeners = (elements, modalInstance) => {
	const boundHandlers = {
		/**
		 * A single, unified click handler to manage both opening and closing the modal.
		 * This avoids race conditions and event propagation issues.
		 */
		unifiedClickHandler: (event) => {
			// If the modal is currently open, we only care about closing it.
			if (modalInstance.isOpen) {
				// Close the modal ONLY if the click is on the backdrop itself.
				if (event.target === elements.modal) {
					modalInstance.closeModal();
				}
				// Ignore all other clicks while the modal is open.
				return;
			}
			
			// If the modal is NOT open, we only care about opening it.
			const photoThumb = event.target.closest('.photo-thumb');
			const cameraLink = event.target.closest('.camera-link');

			if (photoThumb) {
				event.preventDefault();
				const img = photoThumb.querySelector('img');
				if (img) {
					modalInstance.openModal(img.src, img.alt, img.dataset.title, photoThumb, photoThumb);
				}
			} else if (cameraLink) {
				event.preventDefault();
				const imageUrl = cameraLink.dataset.image;
				const peakName = cameraLink.dataset.title;
			
				if (imageUrl) {
					modalInstance.openModal(
						imageUrl,
						peakName || 'Peak image',
						peakName,
						cameraLink,
						cameraLink
					);
				}
			}
		},
		
		keydownHandler: (event) => {
			// Only handle keyboard events when modal is open
			if (!modalInstance.isOpen) return;
			
			const { key } = event;
			
			if (key === 'Escape') {
				event.preventDefault();
				modalInstance.closeModal();
			} else if (key === 'ArrowRight') {
				event.preventDefault();
				modalInstance.navigateImage(1);
			} else if (key === 'ArrowLeft') {
				event.preventDefault();
				modalInstance.navigateImage(-1);
			}
		},
		
		closeClickHandler: () => modalInstance.closeModal(),
		
		modalTransitionEndHandler: (event) => {
			if (event.propertyName === 'opacity' && elements.modal.style.opacity === '0') {
				elements.modal.style.display = 'none';
				if (modalInstance.originalTriggerElement) {
					modalInstance.originalTriggerElement.focus();
				}
			}
		},
	};

	// Listen on document for keyboard events
	document.addEventListener('click', boundHandlers.unifiedClickHandler);
	document.addEventListener('keydown', boundHandlers.keydownHandler, true); // Use capture phase
	elements.modal.addEventListener('transitionend', boundHandlers.modalTransitionEndHandler);

	return boundHandlers;
};

export const cleanupEventListeners = (handlers) => {
	document.removeEventListener('click', handlers.unifiedClickHandler);
	document.removeEventListener('keydown', handlers.keydownHandler, true);
};