export default {

	extends: ['stylelint-config-standard'],
	ignoreFiles: ['../css/dist/**/*.css'],
	plugins: ['stylelint-order'],
	rules: {
		'alpha-value-notation': null,
		'custom-property-empty-line-before': null,
		'declaration-block-no-redundant-longhand-properties': null,
		'declaration-empty-line-before': null,
		'function-url-quotes': null,
		'hue-degree-notation': null,
		'length-zero-no-unit': null,
		'lightness-notation': null,
		'media-feature-name-value-no-unknown': null,
		'media-feature-range-notation': null,
		'no-descending-specificity': null,
		'order/properties-alphabetical-order': true,
		'property-no-deprecated': null,
		'property-no-vendor-prefix': null,
		'rule-empty-line-before': null,
		'selector-class-pattern': null,
		'shorthand-property-no-redundant-values': null,
		'value-keyword-case': null
	}
};
