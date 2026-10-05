// Helpers for calendar dates stored as 'YYYY-MM-DD' strings.
// All maths is done in UTC so time zones can never shift a date by a day.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toUtc(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's date on this device, as 'YYYY-MM-DD'. */
export function todayString() {
  const now = new Date();
  return fromUtc(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Every date from start to end, inclusive. */
export function datesInRange(start: string, end: string) {
  const dates: string[] = [];
  for (let ms = toUtc(start); ms <= toUtc(end); ms += DAY_MS) {
    dates.push(fromUtc(ms));
  }
  return dates;
}

/** Number of days from start to end, inclusive. */
export function dayCount(start: string, end: string) {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
}

/** Number of Mon–Fri days from start to end, inclusive (the days that need leave). */
export function weekdayCount(start: string, end: string) {
  return datesInRange(start, end).filter((date) => {
    const day = new Date(toUtc(date)).getUTCDay(); // 0 = Sunday, 6 = Saturday
    return day !== 0 && day !== 6;
  }).length;
}

/** '2026-12-20' → '20 Dec' */
export function formatDay(date: string) {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** → '20 Dec – 28 Dec (9 days)' or '20 Dec (1 day)' */
export function formatRange(start: string, end: string) {
  const days = dayCount(start, end);
  const label = start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
  return `${label} (${days} ${days === 1 ? 'day' : 'days'})`;
}
