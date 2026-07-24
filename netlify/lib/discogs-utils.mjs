const DISCOGS_API_BASE = 'https://api.discogs.com';
const MEDIA_TYPES = new Set(['Vinyl', 'CD', 'Cassette']);
const PUBLIC_CACHE_CONTROL = [
  'public',
  'durable',
  'max-age=900',
  'stale-while-revalidate=86400'
].join(', ');

class DiscogsError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DiscogsError';
    this.status = status;
  }
}

const getMediaType = (formats) => {
  if (!Array.isArray(formats)) return 'Vinyl';
  return formats.map(format => format.name).find(name => MEDIA_TYPES.has(name)) || 'Vinyl';
};

const fetchDiscogs = async (path, token) => {
  const response = await fetch(`${DISCOGS_API_BASE}${path}`, {
    headers: { Authorization: `Discogs token=${token}` }
  });

  if (!response.ok) {
    throw new DiscogsError(
      response.status,
      `Discogs API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
};

const getCredentials = () => {
  const { DISCOGS_USERNAME: username, DISCOGS_TOKEN: token } = process.env;

  if (!username || !token) {
    throw new DiscogsError(500, 'Missing Discogs credentials');
  }

  return { username, token };
};

const rejectUnsupportedMethod = (request) => {
  if (request.method === 'GET') return null;

  return createResponse(405, { error: 'Method not allowed' }, {
    Allow: 'GET',
    'Cache-Control': 'no-store'
  });
};

const sampleItems = (items, count) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
};

const createResponse = (status, body, headers = {}) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
);

const createCachedResponse = (body) => createResponse(200, body, {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': PUBLIC_CACHE_CONTROL
});

const createErrorResponse = (error, fallbackMessage) => {
  const statusCode = Number.isInteger(error.status) ? error.status : 500;
  return createResponse(statusCode, { error: fallbackMessage }, {
    'Cache-Control': 'no-store'
  });
};

export {
  createCachedResponse,
  createErrorResponse,
  fetchDiscogs,
  getCredentials,
  getMediaType,
  rejectUnsupportedMethod,
  sampleItems
};
