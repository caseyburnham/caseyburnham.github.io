const PHOTO_SECTIONS = new Set(['galleries', 'mountains']);

export function getPhotoRoute(location = window.location) {
	const [hash, query = ''] = location.hash.split('?');
	const section = hash.slice(1);
	if (!PHOTO_SECTIONS.has(section)) return null;
	const params = new URLSearchParams(query);
	return {
		section,
		gallery: section === 'galleries' ? params.get('gallery') || null : null,
		photo: params.get('photo') || null
	};
}

export function setPhotoRoute({
	section = 'galleries',
	gallery,
	photo = null
}, {
	replace = false
} = {}) {
	const url = new URL(window.location.href);
	const params = new URLSearchParams();
	if (section === 'galleries' && gallery) params.set('gallery', gallery);
	if (photo) params.set('photo', photo);
	url.hash = params.size ? `#${section}?${params}` : `#${section}`;
	window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
}
