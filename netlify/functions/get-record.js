// ============================================================================
// Netlify Function: get-record
// Fetches random unique records from a Discogs collection
// ============================================================================

const DISCOGS_API_BASE = 'https://api.discogs.com';
const FOLDER_ID = '2166321'; //Headstash

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
 * Fetches collection folder info to get total item count
 */
const getCollectionInfo = async (username, token) => {
  const url = `${DISCOGS_API_BASE}/users/${username}/collection/folders/${FOLDER_ID}`;
  const response = await fetch(url, { 
	headers: createAuthHeader(token) 
  });
  
  if (!response.ok) {
	throw new Error(`Failed to fetch collection info: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Generates a set of unique random page numbers
 */
const generateUniquePages = (count, totalItems) => {
  const pages = new Set();
  
  while (pages.size < count) {
	const randomPage = Math.floor(Math.random() * totalItems) + 1;
	pages.add(randomPage);
  }
  
  return Array.from(pages);
};

/**
 * Fetches a single record from a specific page
 */
const fetchRecordFromPage = async (username, token, page) => {
  const url = `${DISCOGS_API_BASE}/users/${username}/collection/folders/${FOLDER_ID}/releases?page=${page}&per_page=1`;
  const response = await fetch(url, { 
	headers: createAuthHeader(token) 
  });
  
  if (!response.ok) {
	throw new Error(`Failed to fetch record from page ${page}: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Transforms raw Discogs data into simplified format
 */
const transformRecordData = (recordData) => {
  const release = recordData.releases[0];
  const basic = release.basic_information;
  
  return {
	artist: basic.artists[0].name,
	title: basic.title,
	cover_image: basic.cover_image,
	rating: release.rating,
	url: `https://www.discogs.com/release/${basic.id}`,
	mediaType: getMediaType(basic.formats)
  };
};

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
  const count = parseInt(event.queryStringParameters?.count) || 1;
  
  if (count < 1 || count > 50) {
	return {
	  statusCode: 400,
	  body: JSON.stringify({ 
		error: 'Count must be between 1 and 50' 
	  })
	};
  }
  
  try {
	// Get total items in collection
	const collectionInfo = await getCollectionInfo(username, token);
	const totalItems = collectionInfo.count;
	
	// Validate we have enough items
	if (totalItems < count) {
	  return {
		statusCode: 400,
		body: JSON.stringify({ 
		  error: `Cannot fetch ${count} unique items, only ${totalItems} in collection` 
		})
	  };
	}
	
	// Generate unique random pages and fetch records
	const pages = generateUniquePages(count, totalItems);
	const recordPromises = pages.map(page => 
	  fetchRecordFromPage(username, token, page)
	);
	
	const recordsData = await Promise.all(recordPromises);
	const records = recordsData.map(transformRecordData);
	
	return {
	  statusCode: 200,
	  body: JSON.stringify(records)
	};
	
  } catch (error) {
	console.error('Error in get-record function:', error);
	
	return {
	  statusCode: 500,
	  body: JSON.stringify({ 
		error: 'Failed to fetch data from Discogs',
		message: error.message 
	  })
	};
  }
};