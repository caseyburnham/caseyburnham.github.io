export function isValidCalendarDate(year, month, day) {
	if (![year, month, day].every(Number.isInteger)) return false;
	if (month < 1 || month > 12 || day < 1) return false;

	const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return day <= daysInMonth[month - 1];
}

export function isValidIsoDate(value) {
	if (typeof value !== 'string') return false;

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;

	return isValidCalendarDate(...match.slice(1).map(Number));
}
