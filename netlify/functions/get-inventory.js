// ============================================================================
// Netlify Function: get-inventory
// Fetches random items from Discogs marketplace inventory
// ============================================================================

const DISCOGS_API_BASE = 'https://api.discogs.com';

/**
 * Determines the primary media type from Discogs format data
 */
const getMediaType = (formats) => {
  if (!Array.isArray(formats)) return 'Vinyl';
  
  const formatNames = formats.map(f => f.name);
  
  if (formatNames.includes('Vinyl')) return 'Vinyl';
  if (formatNames.includes('CD')) return 'CD';
  if (formatNames.includes('Cassette')) return 'Cassette';
  
  return 'Vinyl';
};

/**
 * Creates Discogs API authorization header
 */
const createAuthHeader = (token) => ({
  'Authorization': `Discogs token=${token}`
});

/**
 * Fetches initial pagination data to determine total pages
 */
const getPaginationInfo = async (username, token, perPage) => {
  const url = `${DISCOGS_API_BASE}/users/${username}/inventory?per_page=${perPage}`;
  const response = await fetch(url, { 
	headers: createAuthHeader(token) 
  });
  
  if (!response.ok) {
	throw new Error(`Failed to fetch pagination data: ${response.status}`);
  }
  
  const data = await response.json();
  return data.pagination;
};

/**
 * Fetches inventory items from a specific page
 */
const fetchInventoryPage = async (username, token, page, perPage) => {
  const url = `${DISCOGS_API_BASE}/users/${username}/inventory?sort=listed&sort_order=desc&page=${page}&per_page=${perPage}`;
  const response = await fetch(url, { 
	headers: createAuthHeader(token) 
  });
  
  if (!response.ok) {
	const errorBody = await response.text();
	console.error('Discogs API Error:', {
	  status: response.status,
	  statusText: response.statusText,
	  body: errorBody
	});
	throw new Error(`Failed to fetch inventory page: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Transforms raw inventory data into simplified format
 */
const transformInventoryItem = (item) => ({
  artist: item.release.artist,
  title: item.release.title,
  cover_image: item.release.thumbnail,
  price: item.price.value.toFixed(2),
  url: item.uri,
  mediaType: getMediaType(item.release.formats)
});

/**
 * Main handler function
 */
exports.handler = async (event) => {
  const { DISCOGS_USERNAME: username, DISCOGS_TOKEN: token } = process.env;
  
  // Validate environment variables
  if (!username || !token) {
	return {
	  statusCode: 500,
	  body: JSON.stringify({ 
		error: 'Server configuration error: Missing Discogs credentials' 
	  })
	};
  }
  
  // Parse and validate count parameter
  const count = parseInt(event.queryStringParameters?.count) || 5;
  
  if (count < 1 || count > 100) {
	return {
	  statusCode: 400,
	  body: JSON.stringify({ 
		error: 'Count must be between 1 and 100' 
	  })
	};
  }
  
  try {
	// Get pagination info to determine total pages
	const pagination = await getPaginationInfo(username, token, count);
	const totalPages = pagination.pages;
	
	// If no inventory, return empty array
	if (totalPages === 0) {
	  return {
		statusCode: 200,
		body: JSON.stringify([])
	  };
	}
	
	// Select a random page
	const randomPage = Math.floor(Math.random() * totalPages) + 1;
	
	// Fetch inventory from random page
	const inventoryData = await fetchInventoryPage(username, token, randomPage, count);
	const inventory = inventoryData.listings.map(transformInventoryItem);
	
	return {
	  statusCode: 200,
	  body: JSON.stringify(inventory)
	};
	
  } catch (error) {
	console.error('Error in get-inventory function:', error);
	
	return {
	  statusCode: 500,
	  body: JSON.stringify({ 
		error: 'Failed to fetch inventory',
		message: error.message 
	  })
	};
  }
};