const {
  createErrorResponse,
  createResponse,
  fetchDiscogs,
  getCredentials,
  getMediaType,
  parseCount
} = require('./discogs-utils');

const FOLDER_ID = '2166321';

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
    const { username, token } = getCredentials();
    const count = parseCount(event.queryStringParameters?.count, 1, 50);

    const collectionInfo = await fetchDiscogs(
      `/users/${username}/collection/folders/${FOLDER_ID}`,
      token
    );

    if (collectionInfo.count < count) {
      return createResponse(400, {
        error: `Cannot fetch ${count} items, only ${collectionInfo.count} available`
      });
    }

    const pages = new Set();
    while (pages.size < count) {
      pages.add(Math.floor(Math.random() * collectionInfo.count) + 1);
    }

    const records = await Promise.all(
      Array.from(pages).map(page =>
        fetchDiscogs(
          `/users/${username}/collection/folders/${FOLDER_ID}/releases?page=${page}&per_page=1`,
          token
        ).then(transformRecord)
      )
    );

    return createResponse(200, records);
  } catch (error) {
    console.error('get-record error:', error);
    return createErrorResponse(error, 'Failed to fetch records');
  }
};
