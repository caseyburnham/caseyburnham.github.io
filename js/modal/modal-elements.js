/**
 * Separated file for modal HTML structure.
 * @file modal-elements.js
 */
export const createModalHTML = () => `
  <div class="modal-content" role="document">
	<button class="modal-close" aria-label="Close modal">&#10005;</button>
	<div class="modal-card">
	  <img src="" alt="" role="img" aria-live="polite">
	  <div class="modal-caption" role="complementary"></div>
	</div>
	<div class="modal-copyright"></div>
  </div>
`;