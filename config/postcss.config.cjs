module.exports = {
	plugins: [
		require('postcss-import')({
			path: ['css', 'node_modules']
		}),
		require('./purge-maplibre.cjs'),
		require('postcss-sorting')({
			'properties-order': 'alphabetical'
		}),
		require('cssnano')({
			preset: ['default', { calc: false }]
		})
	]
};
