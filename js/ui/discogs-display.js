import dataCache from '../utils/data-cache.js';
const FETCH_COUNT = 5;
const MEDIA_IMAGES = {
	Vinyl: 'vinyl-record.png',
	CD: 'cd-disc.png',
	Cassette: 'cassette-tape.png'
};
const sections = [{
		wrapperId: 'discogs-collection-wrapper',
		sleeveContainerId: 'discogs-sleeve-container',
		captionContainerId: 'discogs-caption-container',
		statusId: 'discogs-collection-status',
		templateId: 'record-template',
		endpoint: '/api/discogs/records',
		loadingMessage: 'Loading collection…',
		emptyMessage: 'No collection records are available.',
		errorMessage: 'Could not fetch records at this time.',
		showPrice: false
	}, {
		wrapperId: 'discogs-inventory-wrapper',
		sleeveContainerId: 'discogs-inventory-sleeve-container',
		captionContainerId: 'discogs-inventory-caption-container',
		statusId: 'discogs-inventory-status',
		templateId: 'record-template',
		endpoint: '/api/discogs/inventory',
		loadingMessage: 'Loading sale items…',
		emptyMessage: 'No records are currently for sale.',
		errorMessage: 'Could not fetch sale items.',
		showPrice: true
	}].map(section => ({
		...section,
		wrapper: document.getElementById(section.wrapperId),
		sleeveContainer: document.getElementById(section.sleeveContainerId),
		captionContainer: document.getElementById(section.captionContainerId),
		status: document.getElementById(section.statusId),
		template: document.getElementById(section.templateId)
	}))
	.filter(section => section.wrapper && section.sleeveContainer && section.captionContainer && section.status && section.template);

function createRecord(template, data, showPrice) {
	const clone = template.content.cloneNode(true);
	const record = clone.querySelector('.discogs-record');
	const link = clone.querySelector('.record-link');
	const cover = clone.querySelector('.album-art');
	const mediaImage = clone.querySelector('.album-media');
	const title = clone.querySelector('.record-title');
	const artist = data.artist?.replace(/\s\(\d+\)$/, '') || 'Unknown';
	const mediaType = MEDIA_IMAGES[data.mediaType] ? data.mediaType : 'Vinyl';
	link.href = data.url || '#';
	cover.src = data.cover_image || '';
	cover.alt = `${data.title || 'Unknown'} by ${artist}`;
	mediaImage.src = `/images/assets/png/${MEDIA_IMAGES[mediaType]}`;
	mediaImage.alt = `${mediaType} format`;
	record.classList.add(`is-${mediaType.toLowerCase()}`);
	title.textContent = data.title || 'Unknown';
	title.classList.toggle('is-favorite', data.rating === 5);
	clone.querySelector('.record-artist')
		.textContent = artist;
	if (showPrice) {
		const price = clone.querySelector('.record-price');
		if (data.price) {
			price.value = data.price;
			price.textContent = `$${data.price}`;
			price.hidden = false;
		}
	}
	return clone;
}

function renderSection(section, records) {
	let topIndex = 1;
	const sleeveFragment = document.createDocumentFragment();
	const captionFragment = document.createDocumentFragment();
	records.slice(0, FETCH_COUNT)
		.forEach(recordData => {
			const record = createRecord(section.template, recordData, section.showPrice);
			const [sleeve, caption] = record.children;
			// Retain activation order while the media retracts after hover or focus leaves.
			const raiseRecord = () => { sleeve.style.zIndex = String(++topIndex); };
			const link = sleeve.querySelector('.record-link');
			link.addEventListener('pointerenter', raiseRecord);
			link.addEventListener('focus', raiseRecord);
			sleeveFragment.appendChild(sleeve);
			captionFragment.appendChild(caption);
		});
	section.sleeveContainer.replaceChildren(section.status, sleeveFragment);
	section.captionContainer.replaceChildren(captionFragment);
}

function setStatus(section, message = '') {
	section.status.textContent = message;
	section.status.hidden = !message;
}
async function loadSection(section) {
	setStatus(section, section.loadingMessage);
	section.wrapper.setAttribute('aria-busy', 'true');
	try {
		const records = await dataCache.fetch(section.endpoint);
		if (records.length === 0) {
			setStatus(section, section.emptyMessage);
			return;
		}
		renderSection(section, records);
		setStatus(section);
	}
	catch (error) {
		console.error(`Failed to load ${section.endpoint}:`, error);
		setStatus(section, section.errorMessage);
	}
	finally {
		section.wrapper.removeAttribute('aria-busy');
	}
}
export async function initDiscogs() {
	await Promise.all(sections.map(loadSection));
}
