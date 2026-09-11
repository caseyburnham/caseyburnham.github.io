export function updateElement(document, selector, content) {
	const element = document.querySelector(selector);
	if (element) element.textContent = content;
}
export function createTallyList(document, entries, template, {
	itemClass = () => ''
} = {}) {
	const fragment = document.createDocumentFragment();
	entries.forEach((entry, index) => {
		const [name, count] = entry;
		const tally = template.content.firstElementChild.cloneNode(true);
		const nameElement = tally.querySelector('.table-tally-name');
		const className = itemClass(entry);
		nameElement.textContent = name;
		tally.querySelector('.table-tally-count')
			.textContent = count;
		if (className) nameElement.classList.add(className);
		fragment.appendChild(tally);
		if (index < entries.length - 1) {
			fragment.append(', ', document.createElement('wbr'));
		}
	});
	return fragment;
}
