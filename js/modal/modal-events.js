/**
 * Separated file for event listener management.
 * @file modal-events.js
 */
export const setupEventListeners = (elements, modalInstance) => {
	const boundHandlers = {
		globalClickHandler: (event) => {
			
			const photoThumb = event.target.closest('.photo-thumb');
			const cameraLink = event.target.closest('.camera-link');
			
			if (photoThumb) {
				event.preventDefault();
				const img = photoThumb.querySelector('img');
				if (img) {
					// Pass the basic img.src. The openModal function will automatically
					// find the best source (AVIF, etc.) from the data-sources attribute.
					modalInstance.openModal(img.src, img.alt, img.dataset.title, photoThumb, photoThumb);
				}
			} else if (cameraLink) {
				event.preventDefault();
				const imageUrl = cameraLink.dataset.image;
				if (imageUrl) {
					const alt = cameraLink.title || cameraLink.getAttribute('aria-label') || 'Camera Image';
					modalInstance.openModal(imageUrl, alt, (cameraLink.dataset && cameraLink.dataset.title), cameraLink, cameraLink);
				}
			}
		},
		
		keydownHandler: (event) => {
			const {
				key
			} = event;
			if (modalInstance.isOpen) {
				if (key === 'Escape') modalInstance.closeModal();
				if (key === 'ArrowRight') modalInstance.navigateImage(1);
				if (key === 'ArrowLeft') modalInstance.navigateImage(-1);
			}
		},
		closeClickHandler: () => modalInstance.closeModal(),
		modalBackgroundClickHandler: (event) => {
			if (event.target === elements.modal && !modalInstance.modalOpenDebounceTimeout) {
				modalInstance.closeModal();
			}
		},
		
		modalTransitionEndHandler: (event) => {
			if (event.propertyName === 'opacity' && elements.modal.style.opacity === '0') {
				elements.modal.style.display = 'none';
				if (modalInstance.originalTriggerElement) {
					modalInstance.originalTriggerElement.focus();
				}
			}
		},
		

	};

	document.addEventListener('click', boundHandlers.globalClickHandler);
	document.addEventListener('keydown', boundHandlers.keydownHandler);
	elements.closeBtn.addEventListener('click', boundHandlers.closeClickHandler);
	elements.modal.addEventListener('click', boundHandlers.modalBackgroundClickHandler);
	elements.modal.addEventListener('transitionend', boundHandlers.modalTransitionEndHandler);
	elements.modalCard.addEventListener('click', boundHandlers.modalCardClickHandler);

	return boundHandlers;
};

export const cleanupEventListeners = (handlers) => {
	document.removeEventListener('click', handlers.globalClickHandler);
	document.removeEventListener('keydown', handlers.keydownHandler);
};