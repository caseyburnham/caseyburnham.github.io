export function updateElement(selector, content) {
	const element = document.querySelector(selector);
	if (element) element.textContent = content;
}
export function createTallyList(entries, template, {
	itemClass = () => ''
} = {}) {
	const fragment = document.createDocumentFragment();
	entries.forEach((entry, index) => {
		const [name, count] = entry;
		const tally = template.content.cloneNode(true);
		const nameElement = tally.querySelector('.table-tally-name');
		const className = itemClass(entry);
		nameElement.textContent = name;
		tally.querySelector('.table-tally-count')
			.textContent = count;
		if (className) nameElement.classList.add(className);
		if (index === entries.length - 1) {
			tally.querySelector('.table-tally-separator')
				?.remove();
			tally.querySelector('.table-tally-break')
				?.remove();
		}
		fragment.appendChild(tally);
	});
	return fragment;
}