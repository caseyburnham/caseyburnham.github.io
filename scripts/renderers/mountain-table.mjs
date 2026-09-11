import {
	formatExifDate,
	normalizeImagePath
}
from '../../js/utils/exif-utils.js';
import {
	updateElement
}
from './table-utils.mjs';
const ELEVATION = {
	MIN: 13000,
	MAX: 14440
};
const RANGE_CHART = {
	HEIGHT: 30,
	PADDING: 2,
	WIDTH: 100
};
const RANGES_ORDERED = ['Front', 'Tenmile', 'Mosquito', 'Gore', 'Elks', 'Sawatch', 'Sangre de Cristo', 'San Juan'];
export function processMountains(mountains, exifData) {
	if (!Array.isArray(mountains)) return [];
	return mountains.map(mountain => {
			let displayDate = mountain.Date;
			if (mountain.Image && exifData) {
				const exif = exifData[normalizeImagePath(mountain.Image)];
				const exifDate = exif?.date && formatExifDate(exif.date);
				if (exifDate) displayDate = exifDate;
			}
			return {
				...mountain,
				displayDate,
				year: displayDate ? displayDate.substring(0, 4) : 'N/A'
			};
		})
		.sort((a, b) => b.displayDate.localeCompare(a.displayDate));
}

function calculateMountainStats(mountains) {
	const uniquePeaks = new Set();
	const counts = {
		thirteeners: 0,
		fourteeners: 0
	};
	mountains.forEach(mountain => {
		if (!mountain?.Peak || !mountain?.Elevation || uniquePeaks.has(mountain.Peak)) return;
		const elevation = Number.parseInt(mountain.Elevation.replaceAll(',', ''), 10);
		if (!Number.isFinite(elevation)) return;
		uniquePeaks.add(mountain.Peak);
		if (elevation >= 14000) counts.fourteeners += 1;
		else if (elevation >= 13000) counts.thirteeners += 1;
	});
	return {
		total: uniquePeaks.size,
		...counts
	};
}

function renderRangeSummary(document, mountains) {
	const list = document.querySelector('#range-summary-row .range-ridgeline');
	const template = document.getElementById('range-ridge-template');
	if (!list || !template) return;
	const seenPeaks = new Set();
	const rangeSummits = new Map(RANGES_ORDERED.map(range => [range, []]));
	mountains.forEach(mountain => {
		if (!mountain?.Peak || !mountain?.Range || seenPeaks.has(mountain.Peak)) return;
		seenPeaks.add(mountain.Peak);
		const elevation = Number.parseInt(mountain.Elevation?.replaceAll(',', ''), 10);
		if (!rangeSummits.has(mountain.Range) || !Number.isFinite(elevation)) return;
		rangeSummits.get(mountain.Range)
			.push({
				date: mountain.displayDate || mountain.Date || '',
				elevation
			});
	});
	const sorted = Array.from(rangeSummits.entries())
		.sort((a, b) => b[1].length - a[1].length);
	const fragment = document.createDocumentFragment();
	sorted.forEach(([range, summits], rangeIndex) => {
		summits.sort((a, b) => a.date.localeCompare(b.date));
		const count = summits.length;
		const ridge = template.content.firstElementChild.cloneNode(true);
		ridge.querySelector('.range-ridge-name')
			.textContent = range;
		ridge.querySelector('.range-ridge-count')
			.textContent = count;
		const points = summits.map(({ elevation }, index) => {
			const x = count === 1 ? RANGE_CHART.WIDTH / 2 : index / (count - 1) * RANGE_CHART.WIDTH;
			const fraction = (elevation - ELEVATION.MIN) / (ELEVATION.MAX - ELEVATION.MIN);
			const drawableHeight = RANGE_CHART.HEIGHT - RANGE_CHART.PADDING * 2;
			const y = RANGE_CHART.HEIGHT - RANGE_CHART.PADDING - fraction * drawableHeight;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		});
		if (count === 1) points.push(`${RANGE_CHART.WIDTH / 2 + 0.01},${points[0].split(',')[1]}`);
		const filterId = `range-ridge-glow-${rangeIndex}`;
		ridge.querySelector('.range-ridge-filter').id = filterId;
		ridge.querySelector('.range-ridge-line').setAttribute('filter', `url(#${filterId})`);
		const linePoints = points.join(' ');
		ridge.querySelector('.range-ridge-line')
			.setAttribute('points', linePoints);
		ridge.querySelector('.range-ridge-area')
			.setAttribute('points', count ? `0,${RANGE_CHART.HEIGHT} ${linePoints} ${RANGE_CHART.WIDTH},${RANGE_CHART.HEIGHT}` : '');
		if (!count) ridge.classList.add('range-ridge--zero');
		fragment.appendChild(ridge);
	});
	list.replaceChildren(fragment);
}

function styleSequenceGroup(rows) {
	const finalIndex = rows.length - 1;
	rows.forEach((row, index) => {
		const heading = row.querySelector('th');
		if (!heading) return;
		const position = index / finalIndex;
		const lightness = (position * 0.25)
			.toFixed(3);
		const alpha = (0.05 + position * 0.15)
			.toFixed(3);
		heading.style.backgroundColor = `oklch(from var(--color-accent-0) calc(l + ${lightness}) c h / ${alpha})`;
	});
}

function createMountainRow(mountain, template) {
	const row = template.content.cloneNode(true);
	const tableRow = row.querySelector('tr');
	tableRow.querySelector('.mtn-peak')
		.textContent = mountain.Peak || '';
	const elevationData = tableRow.querySelector('.mtn-elevation-data');
	if (mountain.Elevation) {
		const elevation = Number.parseInt(mountain.Elevation.replaceAll(',', ''), 10);
		if (Number.isFinite(elevation) && elevationData) {
			elevationData.textContent = mountain.Elevation;
			elevationData.setAttribute('value', elevation);
			elevationData.style.setProperty('--elevation', elevation);
		}
		else if (elevationData) {
			elevationData.textContent = mountain.Elevation;
		}
	}
	else {
		elevationData?.remove();
	}
	tableRow.querySelector('.mtn-range')
		.textContent = mountain.Range || '';
	const time = tableRow.querySelector('.mtn-date time');
	if (mountain.displayDate && time) {
		time.setAttribute('datetime', mountain.displayDate);
		time.textContent = mountain.displayDate.substring(5);
	}
	else {
		time?.remove();
	}
	const rankCell = tableRow.querySelector('.mtn-rank');
	if (mountain.ranked) rankCell.querySelector('.unranked')
		?.remove();
	else rankCell.querySelector('.ranked')
		?.remove();
	const imageButton = tableRow.querySelector('.camera-link');
	if (mountain.Image && imageButton) {
		imageButton.dataset.title = mountain.Peak;
		imageButton.dataset.image = mountain.Image;
		imageButton.setAttribute('href', mountain.Image);
		imageButton.dataset.photoId = mountain.Image.split('/')
			.at(-1)
			.replace(/\.[^.]+$/, '');
	}
	else {
		imageButton?.remove();
	}
	return tableRow;
}

function createYearSummary(year, count, template) {
	const row = template.content.cloneNode(true);
	row.querySelector('.summary-count')
		.textContent = count;
	row.querySelector('.summary-label')
		.textContent = count === 1 ? 'bag' : 'bags';
	row.querySelector('.summary-year')
		.textContent = year;
	return row.querySelector('tr');
}

function updateProgressBar(document, peakType, current) {
	document.querySelectorAll(`progress.peak-progress[data-peak-type="${peakType}"]`)
		.forEach(progress => {
			const total = Number.parseInt(progress.dataset.total, 10) || 1;
			progress.setAttribute('value', Math.min(current, Number(progress.getAttribute('max'))));
			progress.title = `${current}/${total} ${peakType}`;
		});
}
export function renderMountains(document, mountains) {
	if (!Array.isArray(mountains) || !mountains.length) return;
	const tbody = document.querySelector('#mountains tbody');
	const rowTemplate = document.getElementById('mountain-row-template');
	const summaryTemplate = document.getElementById('summary-row-template');
	if (!tbody || !rowTemplate || !summaryTemplate) return;
	tbody.style.setProperty('--elevation-min', ELEVATION.MIN);
	tbody.style.setProperty('--elevation-max', ELEVATION.MAX);
	const fragment = document.createDocumentFragment();
	let currentYear = null;
	let yearCount = 0;
	let currentDate = null;
	let sameDayGroup = [];
	const finalizeSameDayGroup = () => {
		if (sameDayGroup.length > 1) {
			const firstDateCell = sameDayGroup[0].querySelector('.mtn-date');
			if (firstDateCell) firstDateCell.setAttribute('rowspan', sameDayGroup.length);
			for (const row of sameDayGroup.slice(1)) row.querySelector('.mtn-date')
				?.remove();
			sameDayGroup[0].classList.add('sequence-first');
			sameDayGroup.at(-1)
				.classList.add('sequence-last');
			sameDayGroup.forEach(row => row.classList.add('sequence-group'));
			styleSequenceGroup(sameDayGroup);
		}
		sameDayGroup = [];
	};
	mountains.forEach((mountain, index) => {
		if (currentYear && mountain.year !== currentYear) {
			finalizeSameDayGroup();
			currentDate = null;
			fragment.appendChild(createYearSummary(currentYear, yearCount, summaryTemplate));
			yearCount = 0;
		}
		currentYear = mountain.year;
		yearCount += 1;
		if (mountain.displayDate !== currentDate) {
			finalizeSameDayGroup();
			currentDate = mountain.displayDate;
		}
		const row = createMountainRow(mountain, rowTemplate);
		sameDayGroup.push(row);
		fragment.appendChild(row);
		if (index === mountains.length - 1) {
			finalizeSameDayGroup();
			fragment.appendChild(createYearSummary(currentYear, yearCount, summaryTemplate));
		}
	});
	tbody.replaceChildren(fragment);
	const stats = calculateMountainStats(mountains);
	updateElement(document, '#totalMountains', stats.total);
	updateElement(document, '#thirteeners', stats.thirteeners);
	updateElement(document, '#fourteeners', stats.fourteeners);
	updateProgressBar(document, 'thirteeners', stats.thirteeners);
	updateProgressBar(document, 'fourteeners', stats.fourteeners);
	renderRangeSummary(document, mountains);
}
