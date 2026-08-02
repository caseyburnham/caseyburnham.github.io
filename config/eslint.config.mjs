import eslint from '@eslint/js';
import globals from 'globals';

export default [
	{
		ignores: ['.netlify/**', 'css/dist/**', 'dist/**', 'js/dist/**', 'node_modules/**', 'test-results/**']
	},
	eslint.configs.recommended,
	{
		files: ['js/**/*.js', 'utility/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			globals: {
				...globals.browser,
				__MAP_STYLESHEET_URL__: 'readonly'
			},
			sourceType: 'module'
		}
	},
	{
		files: [
			'config/eslint.config.mjs',
			'netlify/**/*.mjs',
			'config/playwright.config.mjs',
			'scripts/**/*.mjs',
			'test/**/*.mjs',
			'tests/**/*.mjs'
		],
		languageOptions: {
			ecmaVersion: 'latest',
			globals: {
				...globals.browser,
				...globals.node
			},
			sourceType: 'module'
		}
	},
	{
		files: ['config/**/*.cjs'],
		languageOptions: {
			ecmaVersion: 'latest',
			globals: globals.node,
			sourceType: 'commonjs'
		}
	}
];
