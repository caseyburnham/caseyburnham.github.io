// ============================================================================
// Netlify Function: get-inventory
// Fetches random items from Discogs marketplace inventory
// ============================================================================

const DISCOGS_API_BASE = 'https://api.discogs.com';

// Utility: Determine media type from formats
const getMediaType = (formats) => {
  if (!Array.isArray(formats)) return 'Vinyl';
  const formatNames = formats.map(f => f.name);
  return formatNames.find(f => ['Vinyl', 'CD', 'Cassette'].includes(f)) || 'Vinyl';
};

// Utility: Create auth header
const authHeader = (token) => ({ 'Authorization': `Discogs token=${token}` });

// Utility: Fetch from Discogs with error handling
const fetchDiscogs = async (url, token) => {
  const response = await fetch(url, { headers: authHeader(token) });
  if (!response.ok) throw new Error(`Discogs API error: ${response.status}`);
  return response.json();
};

// Transform inventory item
const transformItem = (item) => ({
  artist: item.release.artist,
  title: item.release.title,
  cover_image: item.release.thumbnail,
  price: item.price.value.toFixed(2),
  url: item.uri,
  mediaType: getMediaType(item.release.formats)
});

exports.handler = async (event) => {
  try {
    const { DISCOGS_USERNAME, DISCOGS_TOKEN } = process.env;
    
    if (!DISCOGS_USERNAME || !DISCOGS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Discogs credentials' })
      };
    }
    
    const count = Math.min(Math.max(parseInt(event.queryStringParameters?.count) || 5, 1), 100);
    
    // Get pagination info
    const paginationData = await fetchDiscogs(
      `${DISCOGS_API_BASE}/users/${DISCOGS_USERNAME}/inventory?per_page=${count}`,
      DISCOGS_TOKEN
    );
    
    if (paginationData.pagination.pages === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify([])
      };
    }
    
    // Fetch from random page
    const randomPage = Math.floor(Math.random() * paginationData.pagination.pages) + 1;
    const inventoryData = await fetchDiscogs(
      `${DISCOGS_API_BASE}/users/${DISCOGS_USERNAME}/inventory?sort=listed&sort_order=desc&page=${randomPage}&per_page=${count}`,
      DISCOGS_TOKEN
    );
    
    const inventory = inventoryData.listings.map(transformItem);
    
    return {
      statusCode: 200,
      body: JSON.stringify(inventory)
    };
    
  } catch (error) {
    console.error('get-inventory error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to fetch inventory',
        message: error.message 
      })
    };
  }
};