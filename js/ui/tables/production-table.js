export function renderProductions(productions) {
	if (!Array.isArray(productions) || !productions.length) return;
	const tbody = document.querySelector('#productions tbody');
	const template = document.getElementById('production-row-template');
	if (!tbody || !template) return;
	const fragment = document.createDocumentFragment();
	productions.forEach(production => {
		const row = template.content.cloneNode(true);
		row.querySelector('.prod-production')
			.textContent = production.Production || '';
		row.querySelector('.prod-company')
			.textContent = production.Company || '';
		row.querySelector('.prod-a1')
			.textContent = production.A1 || '';
		row.querySelector('.prod-sd')
			.textContent = production.SD || '';
		row.querySelector('.prod-ad')
			.textContent = production.AD || '';
		row.querySelector('.prod-lz')
			.textContent = production.LZ || '';
		row.querySelector('.prod-notes')
			.textContent = production.Notes || '';
		fragment.appendChild(row);
	});
	tbody.replaceChildren(fragment);
}