import { debounce } from '../utils/shared-utils.js';
import dataCache from '../utils/shared-data.js';

const FETCH_COUNT = 5;
const MEDIA_IMAGES = {
	Vinyl: 'vinyl-record.png',
	CD: 'cd-disc.png',
	Cassette: 'cassette-tape.png'
};

const sections = [
	{
		wrapperId: 'discogs-collection-wrapper',
		sleeveContainerId: 'discogs-sleeve-container',
		captionContainerId: 'discogs-caption-container',
		statusId: 'discogs-collection-status',
		templateId: 'record-template',
		endpoint: '/api/discogs/records',
		loadingMessage: 'Loading collection…',
		emptyMessage: 'No collection records are available.',
		errorMessage: 'Could not fetch records at this time.',
		showPrice: false,
		records: []
	},
	{
		wrapperId: 'discogs-inventory-wrapper',
		sleeveContainerId: 'discogs-inventory-sleeve-container',
		captionContainerId: 'discogs-inventory-caption-container',
		statusId: 'discogs-inventory-status',
		templateId: 'inventory-item-template',
		endpoint: '/api/discogs/inventory',
		loadingMessage: 'Loading sale items…',
		emptyMessage: 'No records are currently for sale.',
		errorMessage: 'Could not fetch sale items.',
		showPrice: true,
		records: []
	}
].map(section => ({
	...section,
	wrapper: document.getElementById(section.wrapperId),
	sleeveContainer: document.getElementById(section.sleeveContainerId),
	captionContainer: document.getElementById(section.captionContainerId),
	status: document.getElementById(section.statusId),
	template: document.getElementById(section.templateId)
})).filter(section =>
	section.wrapper &&
	section.sleeveContainer &&
	section.captionContainer &&
	section.status &&
	section.template
);

function getRecordCount() {
	if (window.innerWidth <= 640) return 2;
	if (window.innerWidth <= 1024) return 3;
	return FETCH_COUNT;
}

const fetchRecords = (endpoint) => dataCache.fetch(endpoint);

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
	clone.querySelector('.record-artist').textContent = artist;

	if (showPrice) {
		const price = clone.querySelector('.record-price');
		if (data.price) {
			price.value = data.price;
			price.textContent = `$${data.price}`;
		} else {
			price.hidden = true;
		}
	}

	return clone;
}

function renderSection(section, count) {
	const sleeveFragment = document.createDocumentFragment();
	const captionFragment = document.createDocumentFragment();

	section.records.slice(0, count).forEach(recordData => {
		const record = createRecord(section.template, recordData, section.showPrice);
		const [sleeve, caption] = record.children;
		sleeveFragment.appendChild(sleeve);
		captionFragment.appendChild(caption);
	});

	section.sleeveContainer.replaceChildren(sleeveFragment);
	section.captionContainer.replaceChildren(captionFragment);
}

function setStatus(section, message = '') {
	section.status.textContent = message;
	section.status.hidden = !message;
}

async function loadSection(section) {
	setStatus(section, section.loadingMessage);
	section.wrapper.classList.add('is-loading');
	section.wrapper.setAttribute('aria-busy', 'true');

	try {
		section.records = await fetchRecords(section.endpoint);

		if (section.records.length === 0) {
			setStatus(section, section.emptyMessage);
			return;
		}

		renderSection(section, visibleRecordCount);
		setStatus(section);
	} catch (error) {
		console.error(`Failed to load ${section.endpoint}:`, error);
		setStatus(section, section.errorMessage);
	} finally {
		section.wrapper.classList.remove('is-loading');
		section.wrapper.removeAttribute('aria-busy');
	}
}

let activeZIndex = 10;

function getSleeve(event) {
	const sleeve = event.target.closest('.album-sleeve');
	return sleeve && event.currentTarget.contains(sleeve) ? sleeve : null;
}

function activateSleeve(sleeve) {
	sleeve.classList.add('is-active');
	sleeve.closest('.discogs-record').style.zIndex = activeZIndex++;
}

function deactivateSleeve(sleeve) {
	sleeve.classList.remove('is-active');
}

function initializeSleeveInteractions() {
	const section = document.getElementById('now-playing');
	if (!section) return;

	section.addEventListener('mouseover', event => {
		const sleeve = getSleeve(event);
		if (sleeve && !sleeve.contains(event.relatedTarget)) {
			activateSleeve(sleeve);
		}
	});

	section.addEventListener('mouseout', event => {
		const sleeve = getSleeve(event);
		if (sleeve && !sleeve.contains(event.relatedTarget)) {
			deactivateSleeve(sleeve);
		}
	});

	section.addEventListener('focusin', event => {
		const sleeve = getSleeve(event);
		if (sleeve) activateSleeve(sleeve);
	});

	section.addEventListener('focusout', event => {
		const sleeve = getSleeve(event);
		if (sleeve && !sleeve.contains(event.relatedTarget)) {
			deactivateSleeve(sleeve);
		}
	});
}

let visibleRecordCount = getRecordCount();

const handleResize = debounce(() => {
	const nextCount = getRecordCount();
	if (nextCount === visibleRecordCount) return;

	visibleRecordCount = nextCount;
	sections.forEach(section => {
		if (section.records.length > 0) {
			renderSection(section, visibleRecordCount);
		}
	});
}, 250);

export async function initDiscogs() {
  if (sections.length === 0) return;

	initializeSleeveInteractions();
	window.addEventListener('resize', handleResize);
	await Promise.all(sections.map(loadSection));
}
