/** Shared template rendering for the build and gallery switches. */
export function createPhotoGrids(document, images, galleryKey) {
	const fragment = document.createDocumentFragment();
	if (!images?.length) return fragment;
	const landscapeRows = createBalancedRows(images, 'landscape', 'landscape-row', 5);
	const portraitRows = createBalancedRows(images, 'portrait', 'portrait-row', 6);
	const panoRows = sortByDate(images.filter(image => image.layout === 'pano')).map(image => ({
		images: [image],
		rowClass: 'pano-row'
	}));
	interleaveRows(landscapeRows, portraitRows, panoRows)
		.forEach(row => {
		if (row.images.length > 0) {
			fragment.appendChild(createImageGrid(document, row.images, row.rowClass, galleryKey));
		}
	});
	return fragment;
}
function sortByDate(images) {
	return [...images].sort((a, b) => {
		const dateComparison = (b.dateCreated || '')
			.localeCompare(a.dateCreated || '');
		return dateComparison || (a.id || '')
			.localeCompare(b.id || '');
	});
}
function createBalancedRows(images, layout, rowClass, maxPerRow) {
	const sorted = sortByDate(images.filter(image => image.layout === layout));
	if (sorted.length === 0) return [];
	const rowCount = Math.ceil(sorted.length / maxPerRow);
	const baseSize = Math.floor(sorted.length / rowCount);
	const extraImages = sorted.length % rowCount;
	let offset = 0;
	return Array.from({
		length: rowCount
	}, (_, index) => {
		const size = baseSize + (index < extraImages ? 1 : 0);
		const row = {
			images: sorted.slice(offset, offset + size),
			rowClass
		};
		offset += size;
		return row;
	});
}
function interleaveRows(landscapeRows, portraitRows, panoRows) {
	const nonPanoRows = [];
	const maxLength = Math.max(landscapeRows.length, portraitRows.length);
	for (let index = 0; index < maxLength; index++) {
		if (landscapeRows[index]) nonPanoRows.push(landscapeRows[index]);
		if (portraitRows[index]) nonPanoRows.push(portraitRows[index]);
	}
	if (panoRows.length === 0) return nonPanoRows;
	const panoSlots = Array.from({
			length: nonPanoRows.length + 1
		},
		() => []);
	panoRows.forEach((row, index) => {
		const slot = Math.floor(
			((index + 1) * nonPanoRows.length) / (panoRows.length + 1));
		panoSlots[slot].push(row);
	});
	const result = [];
	for (let index = 0; index <= nonPanoRows.length; index++) {
		result.push(...panoSlots[index]);
		if (index < nonPanoRows.length) result.push(nonPanoRows[index]);
	}
	return result;
}
function createImageGrid(document, images, rowClass, galleryKey) {
	const gridTemplate = document.getElementById('photo-grid-template');
	const thumbTemplate = document.getElementById('photo-thumb-template');
	const gridFragment = gridTemplate.content.cloneNode(true);
	const row = gridFragment.querySelector('.photo-grid');
	row.classList.add(rowClass);
	const fragment = document.createDocumentFragment();
	images.forEach(image => {
		if (!image?.sources || !Object.keys(image.sources)
			.length) {
			console.warn('Invalid image skipped:', image);
			return;
		}
		const thumbClone = thumbTemplate.content.cloneNode(true);
		const img = thumbClone.querySelector('img');
		const source = Object.values(image.sources)[0];
		thumbClone.querySelector('.photo-thumb').setAttribute('href', source);
		if (image.thumbnailSources) {
			img.setAttribute('srcset', Object.entries(image.thumbnailSources)
				.map(([width, url]) => `${encodeURI(url).replaceAll(',', '%2C')} ${width}w`).join(', '));
			img.setAttribute('sizes', `auto, ${Math.ceil(100 / images.length)}vw`);
		}
		img.src = image.thumbnail || '';
		img.alt = image.alt || 'Untitled';
		img.setAttribute('data-sources', JSON.stringify(image.sources));
		img.setAttribute('data-title', image.title || image.alt || 'Untitled');
		if (image.id) {
			const trigger = thumbClone.querySelector('.photo-thumb');
			trigger.dataset.photoId = image.id;
			trigger.dataset.gallery = galleryKey;
		}
		thumbClone.querySelector('.photo-content-url')
			.href = source;
		thumbClone.querySelector('.photo-name')
			.content = image.title || image.alt || 'Untitled';
		thumbClone.querySelector('.photo-description')
			.content = image.alt || image.title || 'Untitled';
		const dateCreated = thumbClone.querySelector('.photo-date-created');
		if (image.dateCreated) {
			dateCreated.content = image.dateCreated;
		}
		else {
			dateCreated.remove();
		}
		const copyrightNotice = thumbClone.querySelector('.photo-copyright-notice');
		if (image.copyrightNotice) {
			copyrightNotice.content = image.copyrightNotice;
		}
		else {
			copyrightNotice.remove();
		}
		fragment.appendChild(thumbClone);
	});
	row.appendChild(fragment);
	return gridFragment;
}
