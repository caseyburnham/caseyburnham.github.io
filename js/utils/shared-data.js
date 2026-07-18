/** Shared JSON request cache with in-flight request deduplication. */

class DataCache {
  /** @type {Map<string, any>} */
  #cache = new Map();

  /** @type {Map<string, Promise<any>>} */
  #pendingRequests = new Map();

  /**
   * @param {string} url
   * @returns {Promise<any>}
   */
  async fetch(url) {
    if (this.#cache.has(url)) {
      return this.#cache.get(url);
    }

    if (this.#pendingRequests.has(url)) {
      return this.#pendingRequests.get(url);
    }

    const request = this.#fetchAndCache(url);
    this.#pendingRequests.set(url, request);

    try {
      return await request;
    } finally {
      this.#pendingRequests.delete(url);
    }
  }

  /**
   * @param {string} url
   * @returns {Promise<any>}
   */
  async #fetchAndCache(url) {
    const response = await fetch(url);

    if (!response.ok) {
      const error = new Error(
        `Request for ${url} failed: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    this.#cache.set(url, data);
    return data;
  }

}

const dataCache = new DataCache();
export default dataCache;
