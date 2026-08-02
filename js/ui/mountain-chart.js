import {
	Chart,
	registerables
}
from 'chart.js';
import dataCache from '../utils/data-cache.js';
const CHART_MIN = 13000;
const CHART_MAX = 14438;
Chart.register(...registerables);

function getChartColors(canvas) {
	const container = canvas.parentElement;
	const probe = document.createElement('span');
	const colorCanvas = document.createElement('canvas');
	const context = colorCanvas.getContext('2d', {
		willReadFrequently: true
	});
	if (!container || !context) {
		throw new Error('Unable to resolve mountain chart colors');
	}
	colorCanvas.width = 1;
	colorCanvas.height = 1;
	probe.hidden = true;
	container.append(probe);
	const resolveColor = token => {
		probe.style.color = `var(${token})`;
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = getComputedStyle(probe)
			.color;
		context.fillRect(0, 0, 1, 1);
		const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1)
			.data;
		return `rgb(${red} ${green} ${blue} / ${alpha / 255})`;
	};
	try {
		return {
			borderColor: resolveColor('--mountain-chart-color'),
			backgroundColor: resolveColor('--mountain-chart-fill')
		};
	}
	finally {
		probe.remove();
	}
}
async function renderElevationChart(canvasId, dataPath = '/json/mountain-data.json') {
	const mountains = await dataCache.fetch(dataPath);
	const sorted = [...mountains].sort((a, b) => new Date(a.Date) - new Date(b.Date));
	const labels = sorted.map(m => new Date(m.Date + 'T00:00:00')
		.toLocaleDateString('en-US', {
			month: 'short',
			year: '2-digit'
		}));
	const elevations = sorted.map(m => parseInt(m.Elevation.replace(/,/g, ''), 10));
	const canvas = document.getElementById(canvasId);
	if (!canvas) {
		throw new Error(`Chart canvas not found: #${canvasId}`);
	}
	const colors = getChartColors(canvas);
	const chart = new Chart(canvas, {
		type: 'line',
		data: {
			labels,
			datasets: [{
				data: elevations,
				borderColor: colors.borderColor,
				backgroundColor: colors.backgroundColor,
				borderWidth: 1.5,
				pointRadius: 2,
				pointStyle: 'circle',
				pointHoverRadius: 5,
				pointBackgroundColor: colors.borderColor,
				fill: 'origin',
				tension: 0
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					callbacks: {
						title: items => sorted[items[0].dataIndex].Peak
					}
				}
			},
			scales: {
				y: {
					display: false,
					min: CHART_MIN,
					max: CHART_MAX,
					ticks: {
						callback: v => (v / 10)
							.toFixed(0) + 'k'
					},
					grid: {
						color: '#e1e0d9'
					}
				},
				x: {
					display: false,
					grid: {
						display: true
					},
					ticks: {
						maxRotation: 45,
						autoSkip: true,
						maxTicksLimit: 14
					}
				}
			}
		}
	});
	matchMedia('(prefers-color-scheme: dark)')
		.addEventListener('change', () => {
			const nextColors = getChartColors(canvas);
			const [dataset] = chart.data.datasets;
			dataset.borderColor = nextColors.borderColor;
			dataset.backgroundColor = nextColors.backgroundColor;
			dataset.pointBackgroundColor = nextColors.borderColor;
			chart.update('none');
		});
}
export async function initMountainChart() {
	await renderElevationChart('elevationChart');
}
