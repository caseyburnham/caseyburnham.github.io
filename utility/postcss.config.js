module.exports = {
	plugins: [
		require('postcss-import')({
			path: ['css', 'node_modules']
		}),
		require('postcss-sorting')({
			'properties-order': 'alphabetical'
		}),
		require('cssnano')({
			preset: ['default', { calc: false }]
		})
	]
};
