const DISCOGS_API_BASE = 'https://api.discogs.com';
const MEDIA_TYPES = new Set(['Vinyl', 'CD', 'Cassette']);

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

const parseCount = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  return Math.min(Math.max(Number.isNaN(parsed) ? fallback : parsed, 1), maximum);
};

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

const createErrorResponse = (error, fallbackMessage) => {
  const statusCode = Number.isInteger(error.status) ? error.status : 500;
  return createResponse(statusCode, { error: fallbackMessage });
};

module.exports = {
  createErrorResponse,
  createResponse,
  fetchDiscogs,
  getCredentials,
  getMediaType,
  parseCount
};
