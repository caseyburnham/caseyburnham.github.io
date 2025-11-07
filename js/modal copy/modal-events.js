/**
 * Separated file for event listener management.
 * @file modal-events.js
 */
export const setupEventListeners = (elements, modalInstance) => {
	const boundHandlers = {
		unifiedClickHandler: (event) => {
			if (modalInstance.isOpen) {
				if (event.target === elements.modal) {
					modalInstance.closeModal();
				}
				return;
			}

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

		modalTransitionEndHandler: (event) => {
			if (event.propertyName === 'opacity' && elements.modal.style.opacity === '0') {
				elements.modal.style.display = 'none';
				// Focus restoration is handled in closeModal()
			}
		},
	};

	document.addEventListener('click', boundHandlers.unifiedClickHandler);
	document.addEventListener('keydown', boundHandlers.keydownHandler, true); // Use capture phase
	elements.modal.addEventListener('transitionend', boundHandlers.modalTransitionEndHandler);

	return boundHandlers;
};

export const cleanupEventListeners = (handlers, modalElement) => {
	if (!handlers) return;

	document.removeEventListener('click', handlers.unifiedClickHandler);
	document.removeEventListener('keydown', handlers.keydownHandler, true);
	
	// Remove transitionend listener if modal element exists
	if (modalElement && handlers.modalTransitionEndHandler) {
		modalElement.removeEventListener('transitionend', handlers.modalTransitionEndHandler);
	}
};
