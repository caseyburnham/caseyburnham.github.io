/**
 * Removes maplibre-gl.css rules for map UI the site does not use.
 *
 * The map renders a NavigationControl (zoom buttons, no compass), the
 * attribution control, the default logo, popups, and element markers.
 * Rules for everything else (geolocate, fullscreen, scale, terrain,
 * compass, user location, cooperative gestures, ...) are dropped from
 * the built map.css.
 *
 * If the map page gains a new control, add its `.maplibregl-*` class(es)
 * to KEEP or that control's styling will silently disappear.
 */

const KEEP = new Set([
	// Map canvas and interaction states
	'maplibregl-map',
	'maplibregl-canvas-container',
	'maplibregl-canvas',
	'maplibregl-interactive',
	'maplibregl-touch-drag-pan',
	'maplibregl-touch-zoom-rotate',
	'maplibregl-boxzoom',
	'maplibregl-crosshair',
	'maplibregl-desktop-message',
	'maplibregl-mobile-message',

	// Element markers
	'maplibregl-marker',

	// Control containers (navigation top-left, attribution bottom-right)
	'maplibregl-ctrl',
	'maplibregl-ctrl-top-left',
	'maplibregl-ctrl-bottom-right',
	'maplibregl-ctrl-group',
	'maplibregl-ctrl-icon',
	'maplibregl-ctrl-zoom-in',
	'maplibregl-ctrl-zoom-out',
	'maplibregl-ctrl-logo',
	'maplibregl-ctrl-attrib',
	'maplibregl-ctrl-attrib-inner',
	'maplibregl-ctrl-attrib-button',
	'maplibregl-ctrl-attrib-shrink',
	'maplibregl-ctrl-attrib-compact',
	'maplibregl-attrib-empty',
	'maplibregl-compact',
	'maplibregl-compact-show',
	'maplibregl-show',

	// Popups
	'maplibregl-popup',
	'maplibregl-popup-content',
	'maplibregl-popup-tip',
	'maplibregl-popup-close-button',
	'maplibregl-popup-anchor-bottom',
	'maplibregl-popup-anchor-bottom-left',
	'maplibregl-popup-anchor-bottom-right',
	'maplibregl-popup-anchor-left',
	'maplibregl-popup-anchor-right',
	'maplibregl-popup-anchor-top',
	'maplibregl-popup-anchor-top-left',
	'maplibregl-popup-anchor-top-right',
]);

// Referenced only by the purged controls above.
const DROP_KEYFRAMES = new Set([
	'maplibregl-spin',
	'maplibregl-user-location-dot-pulse',
]);

const plugin = () => ({
	postcssPlugin: 'purge-maplibre',
	Once(root) {
		let hasMaplibre = false;
		root.walkRules(rule => {
			if (/\.maplibregl-/.test(rule.selector)) {
				hasMaplibre = true;
				return false;
			}
		});
		if (!hasMaplibre) return; // Not the map build; nothing to purge.

		root.walkRules(rule => {
			const classes = new Set();
			for (const selector of rule.selectors) {
				for (const match of selector.matchAll(/\.maplibregl-[a-z0-9-]+/g)) {
					classes.add(match[0].slice(1));
				}
			}
			if (classes.size > 0 && [...classes].some(c => !KEEP.has(c))) {
				rule.remove();
			}
		});

		root.walkAtRules('keyframes', atRule => {
			if (DROP_KEYFRAMES.has(atRule.params)) {
				atRule.remove();
			}
		});
	},
});
plugin.postcss = true;

module.exports = plugin;
