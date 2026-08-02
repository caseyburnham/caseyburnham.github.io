import {
	formatExifDate,
	normalizeImagePath
}
from '../../utils/exif-utils.js';
import {
	createTallyList,
	updateElement
}
from './table-utils.js';
const ELEVATION = {
	MIN: 13000,
	MAX: 14440
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

function renderRangeSummary(mountains) {
	const cell = document.querySelector('#range-summary-row td');
	const template = document.getElementById('table-tally-template');
	if (!cell || !template) return;
	const seenPeaks = new Set();
	const rangeCounts = new Map(RANGES_ORDERED.map(range => [range, 0]));
	mountains.forEach(mountain => {
		if (!mountain?.Peak || !mountain?.Range || seenPeaks.has(mountain.Peak)) return;
		seenPeaks.add(mountain.Peak);
		if (rangeCounts.has(mountain.Range)) {
			rangeCounts.set(mountain.Range, rangeCounts.get(mountain.Range) + 1);
		}
	});
	const sorted = Array.from(rangeCounts.entries())
		.sort((a, b) => b[1] - a[1]);
	cell.replaceChildren(createTallyList(sorted, template, {
		itemClass: ([, count]) => count === 0 ? 'range-tally--zero' : ''
	}));
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
			const fraction = Math.max(0, Math.min(1, (elevation - ELEVATION.MIN) / (ELEVATION.MAX - ELEVATION.MIN)));
			elevationData.textContent = mountain.Elevation;
			elevationData.value = elevation;
			elevationData.style.setProperty('--elevation-percent', `${(fraction * 100).toFixed(2)}%`);
			elevationData.style.setProperty('--elevation-fraction', fraction.toFixed(3));
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
		time.dateTime = mountain.displayDate;
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
	const imageButton = tableRow.querySelector('.mtn-image button');
	if (mountain.Image && imageButton) {
		imageButton.dataset.title = mountain.Peak;
		imageButton.dataset.image = mountain.Image;
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

function updateProgressBar(peakType, current) {
	document.querySelectorAll(`progress.peak-progress[data-peak-type="${peakType}"]`)
		.forEach(progress => {
			const total = Number.parseInt(progress.dataset.total, 10) || 1;
			progress.value = Math.min(current, progress.max);
			progress.title = `${current}/${total} ${peakType}`;
		});
}
export function renderMountains(mountains) {
	if (!Array.isArray(mountains) || !mountains.length) return;
	const tbody = document.querySelector('#mountains tbody');
	const rowTemplate = document.getElementById('mountain-row-template');
	const summaryTemplate = document.getElementById('summary-row-template');
	if (!tbody || !rowTemplate || !summaryTemplate) return;
	const fragment = document.createDocumentFragment();
	let currentYear = null;
	let yearCount = 0;
	let currentDate = null;
	let sameDayGroup = [];
	const finalizeSameDayGroup = () => {
		if (sameDayGroup.length > 1) {
			const firstDateCell = sameDayGroup[0].querySelector('.mtn-date');
			if (firstDateCell) firstDateCell.rowSpan = sameDayGroup.length;
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
	updateElement('#totalMountains', stats.total);
	updateElement('#thirteeners', stats.thirteeners);
	updateElement('#fourteeners', stats.fourteeners);
	updateProgressBar('thirteeners', stats.thirteeners);
	updateProgressBar('fourteeners', stats.fourteeners);
	renderRangeSummary(mountains);
}