export function visibleProductions(productions) {
	return Array.isArray(productions)
		? productions.filter(production => production.visible)
		: [];
}

export function renderProductions(document, productions) {
	if (!Array.isArray(productions)) return;
	const visible = visibleProductions(productions);
	const tbody = document.querySelector('#productions tbody');
	const template = document.getElementById('production-row-template');
	if (!tbody || !template) return;
	const fragment = document.createDocumentFragment();
	visible.forEach(production => {
		const row = template.content.cloneNode(true);
		row.querySelector('[data-field="production"]')
			.textContent = production.Production || '';
		row.querySelector('[data-field="company"]')
			.textContent = production.Company || '';
		row.querySelector('[data-field="a1"]')
			.textContent = production.A1 || '';
		row.querySelector('[data-field="sd"]')
			.textContent = production.SD || '';
		row.querySelector('[data-field="ad"]')
			.textContent = production.AD || '';
		row.querySelector('[data-field="lz"]')
			.textContent = production.LZ || '';
		row.querySelector('[data-field="notes"]')
			.textContent = production.Notes || '';
		fragment.appendChild(row);
	});
	tbody.replaceChildren(fragment);
}
