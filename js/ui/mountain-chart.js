import { Chart, registerables } from 'chart.js';
import dataCache from '../utils/shared-data.js';

const CHART_MIN = 13000;
const CHART_MAX = 14438;

Chart.register(...registerables);

function getChartColors(canvas) {
  const styles = getComputedStyle(canvas);

  return {
	borderColor: styles.getPropertyValue('--mountain-chart-color').trim(),
	backgroundColor: styles.getPropertyValue('--mountain-chart-fill').trim()
  };
}

async function renderElevationChart(canvasId, dataPath = '/json/mountain-data.json') {
  const mountains = await dataCache.fetch(dataPath);

  const sorted = [...mountains].sort((a, b) => new Date(a.Date) - new Date(b.Date));

  const labels = sorted.map(m =>
	new Date(m.Date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  );
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
		legend: { display: false },
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
		  ticks: { callback: v => (v / 10).toFixed(0) + 'k' },
		  grid: { color: '#e1e0d9' }
		},
		x: {
		  display: false,
		  grid: { display: true },
		  ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 14 }
		}
	  }
	}
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
	const nextColors = getChartColors(canvas);
	const [dataset] = chart.data.datasets;

	dataset.borderColor = nextColors.borderColor;
	dataset.backgroundColor = nextColors.backgroundColor;
	dataset.pointBackgroundColor = nextColors.borderColor;
	chart.update('none');
  });

  return chart;
}

export function initMountainChart() {
  return renderElevationChart('elevationChart');
}
