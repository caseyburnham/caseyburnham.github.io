// ============================================================================
// Netlify Function: get-record
// Fetches random unique records from a Discogs collection
// ============================================================================

const DISCOGS_API_BASE = 'https://api.discogs.com';
const FOLDER_ID = '2166321';

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

// Transform record data
const transformRecord = (data) => {
  const release = data.releases[0];
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

exports.handler = async (event) => {
  try {
    const { DISCOGS_USERNAME, DISCOGS_TOKEN } = process.env;
    
    if (!DISCOGS_USERNAME || !DISCOGS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Discogs credentials' })
      };
    }
    
    const count = Math.min(Math.max(parseInt(event.queryStringParameters?.count) || 1, 1), 50);
    
    // Get collection info
    const collectionInfo = await fetchDiscogs(
      `${DISCOGS_API_BASE}/users/${DISCOGS_USERNAME}/collection/folders/${FOLDER_ID}`,
      DISCOGS_TOKEN
    );
    
    if (collectionInfo.count < count) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: `Cannot fetch ${count} items, only ${collectionInfo.count} available` 
        })
      };
    }
    
    // Generate unique random pages
    const pages = new Set();
    while (pages.size < count) {
      pages.add(Math.floor(Math.random() * collectionInfo.count) + 1);
    }
    
    // Fetch records in parallel
    const records = await Promise.all(
      Array.from(pages).map(page =>
        fetchDiscogs(
          `${DISCOGS_API_BASE}/users/${DISCOGS_USERNAME}/collection/folders/${FOLDER_ID}/releases?page=${page}&per_page=1`,
          DISCOGS_TOKEN
        ).then(transformRecord)
      )
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(records)
    };
    
  } catch (error) {
    console.error('get-record error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to fetch records',
        message: error.message 
      })
    };
  }
};