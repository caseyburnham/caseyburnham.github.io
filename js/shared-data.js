/**
 * Shared Data Cache
 * @file js/shared-data.js
 * 
 * Centralized data loading to prevent multiple fetches of the same JSON files
 * Uses singleton pattern with promise caching
 */

class DataCache {
  /** @type {Map<string, any>} */
  #cache = new Map();
  
  /** @type {Map<string, Promise<any>>} */
  #pendingRequests = new Map();
  
  /**
   * Fetch data with caching and deduplication
   * @param {string} url - URL to fetch
   * @returns {Promise<any>} Parsed JSON data
   * @throws {Error} If fetch fails
   */
  async fetch(url) {
	// Return cached data if available
	if (this.#cache.has(url)) {
	  return this.#cache.get(url);
	}
	
	// Return pending promise if request is already in flight
	if (this.#pendingRequests.has(url)) {
	  return this.#pendingRequests.get(url);
	}
	
	// Create new request
	const promise = this.#fetchAndCache(url);
	this.#pendingRequests.set(url, promise);
	
	try {
	  const data = await promise;
	  return data;
	} finally {
	  // Clean up pending request
	  this.#pendingRequests.delete(url);
	}
  }
  
  /**
   * Actually fetch and cache the data
   * @private
   * @param {string} url - URL to fetch
   * @returns {Promise<any>} Parsed JSON data
   * @throws {Error} If fetch or parse fails
   */
  async #fetchAndCache(url) {
	try {
	  const response = await fetch(url);
	  
	  if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`); // ✅ Throw with context
	  }
	  
	  const data = await response.json();
	  
	  // Cache the result
	  this.#cache.set(url, data);
	  
	  return data;
	} catch (error) {
	  console.error(`Failed to fetch ${url}:`, error);
	  throw error; // ✅ Re-throw for caller to handle
	}
  }
  
  /**
   * Check if data is cached
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  has(url) {
	return this.#cache.has(url);
  }
  
  /**
   * Get cached data without fetching
   * @param {string} url - URL to get
   * @returns {any|undefined}
   */
  get(url) {
	return this.#cache.get(url);
  }
  
  /**
   * Manually set cached data
   * @param {string} url - URL key
   * @param {any} data - Data to cache
   * @returns {void}
   */
  set(url, data) {
	this.#cache.set(url, data);
  }
  
  /**
   * Clear specific cache entry or all cache
   * @param {string} [url] - Optional URL to clear, or clear all if omitted
   * @returns {void}
   */
  clear(url) {
	if (url) {
	  this.#cache.delete(url);
	  this.#pendingRequests.delete(url);
	} else {
	  this.#cache.clear();
	  this.#pendingRequests.clear();
	}
  }
  
  /**
   * Preload data (useful for eager loading)
   * @param {string|string[]} urls - URL or array of URLs to preload
   * @returns {Promise<void>}
   */
  async preload(urls) {
	const urlArray = Array.isArray(urls) ? urls : [urls];
	await Promise.all(urlArray.map(url => this.fetch(url).catch(err => {
	  console.warn(`Preload failed for ${url}:`, err);
	  // Don't throw - preload failures shouldn't break the app
	})));
  }
}

// Create singleton instance
const dataCache = new DataCache();

// Make it globally available
window.dataCache = dataCache;

// Export for ES modules
export default dataCache;