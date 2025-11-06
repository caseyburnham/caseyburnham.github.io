/**
 * Peak Climbing Map - Interactive map displaying summit peaks with GPS data
 */
import dataCache from './shared-data.js';
import { parseExifDate, formatElevation, filenameToTitle } from './shared-utils.js';

class PeakMap {
	constructor(options = {}) {
		const maptilerApiKey = 'Q2YUsN8Bauugiv3dZ0gd';

		this.config = {
			mapContainerId: 'map',
			dataUrl: '/json/exif-data.json',
			defaultCenter: { lat: 39.7392, lon: -104.9849 },
			defaultZoom: 12,
			zoomSnap: 0.25,
			tileLayerUrl: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${maptilerApiKey}`,
			tileLayerOptions: {
				minZoom: 6,
				maxZoom: 12,
				attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
				ext: 'png'
			},
		};

		this.map = null;
		this.peaks = [];
		this.markerGroup = null;
	}

	async init() {
		try {
			await this.loadAndProcessData();
			this.initializeMap();
			this.addPeaksToMap();
		} catch (error) {
			this.handleError(`Failed to initialize map: ${error.message}`); // ✅ User-visible error
		}
	}

	async loadAndProcessData() {
		const data = await this.loadExifData(); // ✅ Can throw
		this.peaks = this.processExifData(data);

		if (this.peaks.length === 0) {
			throw new Error('No summit peaks found with valid GPS data'); // ✅ Throw for init to catch
		}
	}

	async loadExifData() {
		try {
			return await dataCache.fetch(this.config.dataUrl); // ✅ Can throw
		} catch (error) {
			throw new Error(`Failed to load EXIF data: ${error.message}`); // ✅ Add context
		}
	}

	processExifData(data) {
		const peaks = [];

		Object.entries(data)
			.forEach(([filepath, exifData]) => {
				const peak = this.createPeakFromExif(filepath, exifData);
				if (peak) { // ✅ Safe - returns null on error
					peaks.push(peak);
				}
			});

		return peaks;
	}

	createPeakFromExif(filepath, exifData) {
		try {
			if (!filepath.startsWith('summits/')) {
				return null; // ✅ Expected - not an error
			}

			if (!this.isValidExifData(exifData)) {
				return null; // ✅ Expected - not an error
			}

			const filename = this.extractFilename(filepath);
			if (!filename) return null;

			const { lat, lon } = this.extractCoordinates(exifData.gps);
			if (!this.areValidCoordinates(lat, lon)) {
				return null; // ✅ Expected - not an error
			}

			return {
				title: filenameToTitle(filename),
				filename,
				filepath,
				lat,
				lon,
				altitude: this.extractAltitude(exifData.gps),
				date: parseExifDate(exifData.date),
				coordinates: {
					lat: exifData.gps.latDMS || `${lat.toFixed(6)}°`,
					lon: exifData.gps.lonDMS || `${lon.toFixed(6)}°`
				}
			};
		} catch (error) {
			console.warn(`Error processing ${filepath}:`, error.message);
			return null; // ✅ Log and continue
		}
	}

	isValidExifData(exifData) {
		return exifData &&
			typeof exifData === 'object' &&
			exifData.gps &&
			typeof exifData.gps === 'object';
	}

	extractFilename(filepath) {
		const filename = filepath.split('/')
			.pop();
		return filename || null;
	}

	extractCoordinates(gpsData) {
		const lat = Number(gpsData.lat);
		const lon = Number(gpsData.lon);

		return { lat, lon };
	}

	areValidCoordinates(lat, lon) {
		return !isNaN(lat) &&
			!isNaN(lon) &&
			lat >= -90 && lat <= 90 &&
			lon >= -180 && lon <= 180;
	}

	extractAltitude(gpsData) {
		return (gpsData.alt && typeof gpsData.alt === 'number') ? gpsData.alt : null;
	}

	initializeMap() {
		const mapContainer = document.getElementById(this.config.mapContainerId);
		if (!mapContainer) {
			throw new Error(`Map container '${this.config.mapContainerId}' not found`); // ✅ Throw - critical
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

	addTileLayer() {
		L.tileLayer(this.config.tileLayerUrl, this.config.tileLayerOptions)
			.addTo(this.map);
	}

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

	addPeaksToMap() {
		if (!this.map) {
			throw new Error('Map not initialized'); // ✅ Throw - critical
		}

		this.markerGroup = new L.featureGroup();

		this.peaks.forEach(peak => {
			const marker = this.createPeakMarker(peak);
			if (marker) { // ✅ Safe - returns null on error
				marker.addTo(this.map);
				this.markerGroup.addLayer(marker);
			}
		});

		this.fitMapToBounds();
	}

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
			return null; // ✅ Log and continue
		}
	}

	createCustomIcon() {
		return L.divIcon({
			className: 'map-marker',
			html: `<div></div>`,
			iconSize: [10, 10],
			iconAnchor: [5, 5]
		});
	}

	createPopupContent(peak) {
		const elevation = formatElevation(peak.altitude);
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

	fitMapToBounds() {
		if (this.markerGroup && this.markerGroup.getLayers()
			.length > 0) {
			try {
				this.map.fitBounds(this.markerGroup.getBounds(), {
					padding: [20, 20]
				});
			} catch (error) {
				console.warn('Could not fit map bounds:', error.message);
				// ✅ Not critical - continue
			}
		}
	}

	addCustomStyles() {
		if (document.querySelector('#peak-map-styles')) return;

		const style = document.createElement('style');
		style.id = 'peak-map-styles';

		document.head.appendChild(style);
	}

	handleError(message) {
		console.error('PeakMap Error:', message);

		const mapContainer = document.getElementById(this.config.mapContainerId);
		if (mapContainer) {
			mapContainer.innerHTML = `
		<div class="error" style="padding: 2rem; text-align: center;">
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

	getPeaks() {
		return [...this.peaks];
	}

	getMap() {
		return this.map;
	}
}

import('/js/leaflet.js')
	.then(() => {
		const config = window.PEAK_MAP_CONFIG || {};

		const peakMap = new PeakMap(config);
		peakMap.init()
			.catch(error => {
				console.error('Failed to initialize Peak Map:', error);
			});

		window.peakMap = peakMap;
	})
	.catch(err => {
		console.error("Failed to load leaflet.js dependency:", err);

		const mapContainer = document.getElementById(window.PEAK_MAP_CONFIG?.mapContainerId || 'map');
		if (mapContainer) {
			mapContainer.innerHTML =
				`<div class="error" style="padding: 2rem; text-align: center;">
				<div>
					<strong>Error:</strong> 
					Map library failed to load.
				</div>
			</div>`;
		}
	});