/**
 * Shared Utilities
 * @file js/shared-utils.js
 */

/**
 * @typedef {Object} ExifDateObject
 * @property {number} year
 * @property {number} month
 * @property {number} day
 * @property {number} [hour]
 * @property {number} [minute]
 * @property {number} [second]
 * @property {string} [rawValue]
 */

/**
 * @typedef {Object} ElevationData
 * @property {string} feet - Formatted feet value
 * @property {string} meters - Formatted meters value
 * @property {string} display - Display-ready string
 */

/**
 * @typedef {Object} GPSData
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {number} [alt] - Altitude in meters
 * @property {string} [latDMS] - Latitude in DMS format
 * @property {string} [lonDMS] - Longitude in DMS format
 */

/**
 * @typedef {Object} ExifData
 * @property {ExifDateObject} [date]
 * @property {GPSData} [gps]
 * @property {string} [cameraModel]
 * @property {number} [iso]
 * @property {number} [lens]
 * @property {string} [aperture]
 * @property {string} [shutter]
 * @property {string} [format]
 * @property {string} [copyright]
 * @property {number} [exposureCompensation]
 */

/**
  * Shared Utilities
  * @file js/shared-utils.js
  */
 
 // ============================================================================
 // Date Utilities
 // ============================================================================
 
 /**
  * Parse EXIF date object to JavaScript Date
  * @param {Object|string} dateObj - EXIF date object or date string
  * @returns {Date|null} JavaScript Date object or null
  */
 export function parseExifDate(dateObj) {
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
	 console.warn('Failed to parse date:', error);
	 return null; // ✅ Safe default
   }
 }
 
 /**
  * Format EXIF date object to ISO date string (YYYY-MM-DD)
  * @param {Object|string|Date} input - EXIF date object, date string, or Date object
  * @returns {string|null} ISO date string or null
  */
 export function formatExifDate(input) {
   if (!input) return null;
   
   try {
	 let date;
	 
	 if (input instanceof Date) {
	   date = input;
	 } else if (input.year && input.month && input.day) {
	   const { year, month, day } = input;
	   return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	 } else {
	   date = parseExifDate(input);
	 }
	 
	 if (!date || isNaN(date.getTime())) return null;
	 
	 const year = date.getFullYear();
	 const month = String(date.getMonth() + 1).padStart(2, '0');
	 const day = String(date.getDate()).padStart(2, '0');
	 
	 return `${year}-${month}-${day}`;
   } catch (error) {
	 console.warn('Failed to format date:', error);
	 return null; // ✅ Safe default
   }
 }
 
 /**
  * Format date for display (locale-aware)
  * @param {Object|string|Date} input - Date in any format
  * @param {Object} options - Formatting options
  * @returns {string} Formatted date string
  */
 export function formatDateForDisplay(input, options = {}) {
   const {
	 locale = 'en-US',
	 dateStyle = 'medium'
   } = options;
   
   try {
	 let date;
	 if (input instanceof Date) {
	   date = input;
	 } else {
	   date = parseExifDate(input);
	 }
	 
	 if (!date || isNaN(date.getTime())) return 'Unknown';
	 
	 return date.toLocaleDateString(locale, { dateStyle });
   } catch (error) {
	 console.warn('Failed to format date for display:', error);
	 return 'Unknown'; // ✅ Safe default
   }
 }
 
 // ============================================================================
 // Elevation Utilities
 // ============================================================================
 
 /**
  * Convert meters to feet
  * @param {number} meters - Meters value
  * @returns {number} Feet value
  */
 export function metersToFeet(meters) {
   return meters * 3.28084;
 }
 
 /**
  * Format elevation for display
  * @param {number} altitude - Altitude in meters
  * @param {Object} options - Formatting options
  * @returns {Object} Formatted elevation data
  */
 export function formatElevation(altitude, options = {}) {
   const { 
	 showBoth = false, 
	 unit = 'feet',
	 locale = 'en-US' 
   } = options;
   
   if (!altitude || isNaN(altitude)) {
	 return { feet: 'Unknown', meters: 'Unknown', display: 'Unknown' }; // ✅ Safe default
   }
   
   try {
	 const feet = Math.round(metersToFeet(altitude));
	 const meters = Math.round(altitude);
	 
	 const feetStr = feet.toLocaleString(locale);
	 const metersStr = meters.toLocaleString(locale);
	 
	 let display;
	 if (showBoth) {
	   display = `${feetStr} ft (${metersStr} m)`;
	 } else {
	   display = unit === 'feet' ? `${feetStr} ft` : `${metersStr} m`;
	 }
	 
	 return { feet: feetStr, meters: metersStr, display };
   } catch (error) {
	 console.warn('Failed to format elevation:', error);
	 return { feet: 'Unknown', meters: 'Unknown', display: 'Unknown' }; // ✅ Safe default
   }
 }
 
 // ============================================================================
 // EXIF Data Utilities
 // ============================================================================
 
 /**
  * Find EXIF data for an image source
  * @param {string} imageSrc - Image source URL
  * @param {Object} exifDataset - EXIF data object
  * @returns {Object|null} EXIF data or null
  */
 export function findExifData(imageSrc, exifDataset) {
   if (!exifDataset || Object.keys(exifDataset).length === 0) {
	 return null; // ✅ Safe default
   }
   
   try {
	 const url = new URL(imageSrc, window.location.origin);
	 const normalizedSrcPath = url.pathname.startsWith('/') 
	   ? url.pathname.substring(1) 
	   : url.pathname;
	 
	 const srcPathLower = normalizedSrcPath.toLowerCase();
	 const srcFilename = normalizedSrcPath.split('/').pop().toLowerCase();
	 const srcBaseFilename = srcFilename.split('.')[0];
	 const srcExtension = srcFilename.split('.').pop();
	 
	 const candidates = [];
	 for (const [key, data] of Object.entries(exifDataset)) {
	   const keyBase = key.split('/').pop().toLowerCase().split('.')[0];
	   if (keyBase === srcBaseFilename) {
		 candidates.push({ key, data });
	   }
	 }
	 
	 if (candidates.length === 0) return null;
	 if (candidates.length === 1) return candidates[0].data;
	 
	 const exactMatch = candidates.find(c => c.key.toLowerCase() === srcPathLower);
	 if (exactMatch) return exactMatch.data;
	 
	 const extensionMatch = candidates.find(c => {
	   const keyExtension = c.key.split('.').pop().toLowerCase();
	   return keyExtension === srcExtension;
	 });
	 if (extensionMatch) return extensionMatch.data;
	 
	 console.warn(`Multiple EXIF candidates found for "${srcBaseFilename}", using first match`);
	 return candidates[0].data;
   } catch (error) {
	 console.warn('Error finding EXIF data:', error);
	 return null; // ✅ Safe default
   }
 }
 
 /**
  * Normalize image path for EXIF lookup
  * @param {string} path - Path to normalize
  * @returns {string} Normalized path
  */
 export function normalizeImagePath(path) {
   if (!path) return '';
   return path.replace(/^\/images\//, '');
 }
 
 // ============================================================================
 // Performance Utilities
 // ============================================================================
 
 /**
  * Debounce function
  * @param {Function} func - Function to debounce
  * @param {number} wait - Wait time in milliseconds
  * @returns {Function} Debounced function
  */
 export function debounce(func, wait) {
   let timeout;
   return function executedFunction(...args) {
	 const later = () => {
	   clearTimeout(timeout);
	   func.apply(this, args);
	 };
	 clearTimeout(timeout);
	 timeout = setTimeout(later, wait);
   };
 }
 
 /**
  * Throttle function
  * @param {Function} func - Function to throttle
  * @param {number} limit - Time limit in milliseconds
  * @returns {Function} Throttled function
  */
 export function throttle(func, limit) {
   let inThrottle;
   return function(...args) {
	 if (!inThrottle) {
	   func.apply(this, args);
	   inThrottle = true;
	   setTimeout(() => inThrottle = false, limit);
	 }
   };
 }
 
 // ============================================================================
 // String Utilities
 // ============================================================================
 
 /**
  * Convert filename to readable title
  * @param {string} filename - Filename to convert
  * @returns {string} Formatted title
  */
 export function filenameToTitle(filename) {
   if (!filename) return 'Untitled';
   
   return filename
	 .replace(/\.[^/.]+$/, '')
	 .split(/[-_]/)
	 .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
	 .join(' ');
 }
 
 export default {
   formatExifDate,
   parseExifDate,
   formatDateForDisplay,
   metersToFeet,
   formatElevation,
   findExifData,
   normalizeImagePath,
   debounce,
   throttle,
   filenameToTitle
 };