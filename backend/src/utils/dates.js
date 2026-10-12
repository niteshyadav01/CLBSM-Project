const INDIA = 'Asia/Kolkata';

export function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: INDIA }).format(new Date());
}

export function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

export function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')} IST`;
}

export function monthStart(iso) {
  return `${iso.slice(0, 8)}01`;
}

export function assertDateRange(from, to) {
  if (!isISODate(from) || !isISODate(to)) {
    const error = new Error('Enter a valid from and to date.');
    error.status = 400;
    error.code = 'VALIDATION';
    throw error;
  }
  if (from > to) {
    const error = new Error('The start date must be on or before the end date.');
    error.status = 400;
    error.code = 'VALIDATION';
    throw error;
  }
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((end - start) / 86400000) + 1;
  if (days > 366) {
    const error = new Error('Choose a date range of one year or less.');
    error.status = 400;
    error.code = 'VALIDATION';
    throw error;
  }
}
