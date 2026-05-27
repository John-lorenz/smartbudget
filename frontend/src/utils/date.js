export function formatDateForDisplay(value) {
  if (!value) return '';

  const datePart = String(value).split('T')[0];
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) {
    return String(value);
  }

  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

export function formatDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function displayDateToIso(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function getTodayDisplayDate() {
  const now = new Date();
  return formatDateForDisplay([
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-'));
}

export function getFirstDayOfMonthDisplayDate() {
  const now = new Date();
  return formatDateForDisplay([
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    '01',
  ].join('-'));
}
