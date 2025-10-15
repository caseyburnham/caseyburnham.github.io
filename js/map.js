/**
 * Peak Climbing Map - Interactive map displaying summit peaks with GPS data
 */
class PeakMap {
	constructor(options = {}) {
		const maptilerApiKey = 'Q2YUsN8Bauugiv3dZ0gd';

		this.config = {
			mapContainerId: 'map',
			dataUrl: 'json/exif-data.json',
			defaultCenter: { lat: 39.7392, lon: -104.9849 }, // Denver fallback
			defaultZoom: 12,
			zoomSnap: 0.25,
			tileLayerUrl: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${maptilerApiKey}`,
			tileLayerOptions: {
				minZoom: 6,
				maxZoom: 12,
				attribution:
					'&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
				ext: 'png'
			},
		};

		this.map = null;
		this.peaks = [];
		this.markerGroup = null;
	}

	/**
	 * Initialize the peak map
	 */
	async init() {
		try {
			await this.loadAndProcessData();
			this.initializeMap();
			this.addPeaksToMap();
		} catch (error) {
			this.handleError(`Failed to initialize map: ${error.message}`);
		}
	}

	/**
	 * Load EXIF data and process into peak objects
	 */
	async loadAndProcessData() {
		const data = await this.loadExifData();
		this.peaks = this.processExifData(data);

		if (this.peaks.length === 0) {
			throw new Error('No summit peaks found with valid GPS data');
		}
	}

	/**
	 * Load EXIF data from JSON file
	 */
	async loadExifData() {
		try {
			const response = await fetch(this.config.dataUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			return await response.json();
		} catch (error) {
			throw new Error(`Failed to load ${this.config.dataUrl}: ${error.message}`);
		}
	}

	/**
	 * Process raw EXIF data into peak objects
	 */
	processExifData(data) {
		const peaks = [];

		Object.entries(data).forEach(([filepath, exifData]) => {
			const peak = this.createPeakFromExif(filepath, exifData);
			if (peak) {
				peaks.push(peak);
			}
		});

		return peaks;
	}

	/**
	 * Create a peak object from EXIF data
	 */
	createPeakFromExif(filepath, exifData) {
		try {
			// Only process images from summits folder
			if (!filepath.startsWith('summits/')) {
				return null;
			}

			// Validate EXIF data structure
			if (!this.isValidExifData(exifData)) {
				return null;
			}

			const filename = this.extractFilename(filepath);
			if (!filename) return null;

			const { lat, lon } = this.extractCoordinates(exifData.gps);
			if (!this.areValidCoordinates(lat, lon)) {
				return null;
			}

			return {
				title: this.filenameToTitle(filename),
				filename,
				filepath,
				lat,
				lon,
				altitude: this.extractAltitude(exifData.gps),
				date: this.parseDate(exifData.date),
				coordinates: {
					lat: exifData.gps.latDMS || `${lat.toFixed(6)}°`,
					lon: exifData.gps.lonDMS || `${lon.toFixed(6)}°`
				}
			};
		} catch (error) {
			console.warn(`Error processing ${filepath}:`, error.message);
			return null;
		}
	}

	/**
	 * Validate EXIF data structure
	 */
	isValidExifData(exifData) {
		return exifData &&
			typeof exifData === 'object' &&
			exifData.gps &&
			typeof exifData.gps === 'object';
	}

	/**
	 * Extract filename from filepath
	 */
	extractFilename(filepath) {
		const filename = filepath.split('/').pop();
		return filename || null;
	}

	/**
	 * Extract and validate GPS coordinates
	 */
	extractCoordinates(gpsData) {
		const lat = Number(gpsData.lat);
		const lon = Number(gpsData.lon);

		return { lat, lon };
	}

	/**
	 * Validate GPS coordinates
	 */
	areValidCoordinates(lat, lon) {
		return !isNaN(lat) &&
			!isNaN(lon) &&
			lat >= -90 && lat <= 90 &&
			lon >= -180 && lon <= 180;
	}

	/**
	 * Extract altitude from GPS data
	 */
	extractAltitude(gpsData) {
		return (gpsData.alt && typeof gpsData.alt === 'number') ? gpsData.alt : null;
	}

	/**
	 * Convert filename to readable title
	 */
	filenameToTitle(filename) {
		return filename
			.replace(/\.[^/.]+$/, '') // Remove extension
			.split(/[-_]/) // Split on hyphens and underscores
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Parse date object into Date instance
	 */
	parseDate(dateObj) {
		if (!dateObj) return null;

		try {
			if (dateObj.year && dateObj.month && dateObj.day) {
				return new Date(
					dateObj.year,
					dateObj.month - 1,
					dateObj.day,
					dateObj.hour || 0,
					dateObj.minute || 0,
					dateObj.second || 0
				);
			}

			return new Date(dateObj.rawValue || dateObj);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Initialize the Leaflet map
	 */
	initializeMap() {
		const mapContainer = document.getElementById(this.config.mapContainerId);
		if (!mapContainer) {
			throw new Error(`Map container '${this.config.mapContainerId}' not found`);
		}

		const center = this.calculateMapCenter();

		this.map = L.map(this.config.mapContainerId, {
			center: [center.lat, center.lon],
			zoom: this.config.defaultZoom,
			zoomControl: true
		});

		this.addTileLayer();
		this.addCustomStyles();
	}

	/**
	 * Add tile layer to map
	 */
	addTileLayer() {
		L.tileLayer(this.config.tileLayerUrl, this.config.tileLayerOptions)
			.addTo(this.map);
	}

	/**
	 * Calculate map center from all peaks
	 */
	calculateMapCenter() {
		if (this.peaks.length === 0) {
			return this.config.defaultCenter;
		}

		const totalLat = this.peaks.reduce((sum, peak) => sum + peak.lat, 0);
		const totalLon = this.peaks.reduce((sum, peak) => sum + peak.lon, 0);

		return {
			lat: totalLat / this.peaks.length,
			lon: totalLon / this.peaks.length
		};
	}

	/**
	 * Add peak markers to map
	 */
	addPeaksToMap() {
		if (!this.map) {
			throw new Error('Map not initialized');
		}

		this.markerGroup = new L.featureGroup();

		this.peaks.forEach(peak => {
			const marker = this.createPeakMarker(peak);
			if (marker) {
				marker.addTo(this.map);
				this.markerGroup.addLayer(marker);
			}
		});

		this.fitMapToBounds();
	}

	/**
	 * Create marker for a peak
	 */
	createPeakMarker(peak) {
		try {
			const icon = this.createCustomIcon();
			const marker = L.marker([peak.lat, peak.lon], { icon });
			const popupContent = this.createPopupContent(peak);

			marker.bindPopup(popupContent, {
				maxWidth: 300,
				className: 'custom-popup'
			});

			return marker;
		} catch (error) {
			console.warn(`Failed to create marker for ${peak.title}:`, error.message);
			return null;
		}
	}

	/**
	 * Create custom map icon
	 */
	createCustomIcon() {
		return L.divIcon({
			className: 'map-marker',
			html: `<div></div>`,
			iconSize: [10, 10],
			iconAnchor: [5, 5]
		});
	}

	/**
	 * Create popup content for a peak
	 */
	createPopupContent(peak) {
		const elevation = this.formatElevation(peak.altitude);
		const date = peak.date ? peak.date.toLocaleDateString() : 'Unknown';

		return `
	  <div class="popup-content">
		<div class="popup-title">${peak.title}</div>
		<div class="popup-details">
		  <div class="popup-date">${date}</div>
		  <div class="popup-elevation">${elevation.feet} ft</div>
		</div>
	  </div>
	`;
	}

	/**
	 * Format elevation for display
	 */
	formatElevation(altitude) {
		if (!altitude || isNaN(altitude)) {
			return { feet: 'Unknown', meters: 'Unknown' };
		}

		return {
			feet: Math.round(altitude * 3.28084).toLocaleString(),
			meters: Math.round(altitude).toLocaleString()
		};
	}

	/**
	 * Fit map to show all markers
	 */
	fitMapToBounds() {
		if (this.markerGroup && this.markerGroup.getLayers().length > 0) {
			try {
				this.map.fitBounds(this.markerGroup.getBounds(), {
					padding: [20, 20]
				});
			} catch (error) {
				console.warn('Could not fit map bounds:', error.message);
			}
		}
	}

	/**
	 * Add custom CSS styles
	 */
	addCustomStyles() {
		if (document.querySelector('#peak-map-styles')) return;

		const style = document.createElement('style');
		style.id = 'peak-map-styles';

		document.head.appendChild(style);
	}

	/**
	 * Handle and display errors
	 */
	handleError(message) {
		console.error('PeakMap Error:', message);

		const mapContainer = document.getElementById(this.config.mapContainerId);
		if (mapContainer) {
			mapContainer.innerHTML = `
		<div class="error">
		  <div>
			<div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
			<div><strong>Error:</strong> ${message}</div>
			<div style="margin-top: 10px; font-size: 0.9em; color: #6c757d;">
			  Please check that ${this.config.dataUrl} is accessible and contains valid data.
			</div>
		  </div>
		</div>
	  `;
		}
	}

	/**
	 * Get peak data (public API)
	 */
	getPeaks() {
		return [...this.peaks]; // Return copy to prevent mutation
	}

	/**
	 * Get map instance (public API)
	 */
	getMap() {
		return this.map;
	}
}

/**
 * Initialize the peak map when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
	// Allow for custom configuration via global variable
	const config = window.PEAK_MAP_CONFIG || {};

	const peakMap = new PeakMap(config);
	peakMap.init().catch(error => {
		console.error('Failed to initialize Peak Map:', error);
	});

	// Make instance globally available for debugging/external access
	window.peakMap = peakMap;
});
