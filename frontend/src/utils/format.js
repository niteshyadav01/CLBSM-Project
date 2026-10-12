export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function monthStart(iso = todayISO()) {
  return `${iso.slice(0, 8)}01`;
}

export function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('T')[0].split('-');
  if (!day || !month || !year) return String(value);
  return `${day}-${month}-${year}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')} IST`;
}

export function formatINR(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
