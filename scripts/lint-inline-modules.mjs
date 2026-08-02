import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const filename = 'utility/data-entry.html';
const html = await readFile(filename, 'utf8');
const modules = Array.from(
	html.matchAll(/<script\s+type="module">([\s\S]*?)<\/script>/g),
	match => match[1].replace(/^ {2}/gm, '')
);

if (modules.length === 0) {
	throw new Error(`${filename} contains no inline JavaScript module.`);
}

const eslint = new ESLint({ overrideConfigFile: 'config/eslint.config.mjs' });
const results = await eslint.lintText(modules.join('\n'), {
	filePath: 'utility/data-entry.inline.js'
});
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(results);

if (output) console.error(output);
if (results.some(result => result.errorCount > 0)) process.exitCode = 1;
