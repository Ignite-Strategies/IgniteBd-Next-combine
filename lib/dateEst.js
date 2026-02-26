/**
 * Outreach date helpers: use America/New_York (EST/EDT) so "today" and
 * "Tomorrow" (e.g. due 2/26 after send 2/19) are consistent regardless of server/client timezone.
 */

const TZ = 'America/New_York';

/**
 * Current calendar date in EST (YYYY-MM-DD).
 */
export function getTodayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Calendar day difference in EST: how many days from todayEST to isoDate (date-only string YYYY-MM-DD).
 */
export function dayDiffEST(todayEST, isoDate) {
  if (!isoDate) return null;
  const d = (s) => new Date(s.slice(0, 10) + 'T12:00:00Z');
  return Math.round((d(isoDate) - d(todayEST)) / (24 * 60 * 60 * 1000));
}

/**
 * Format an ISO date string for display in EST (e.g. "Wed, Feb 26").
 */
export function formatDateEST(isoDate, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!isoDate) return '';
  const d = new Date(isoDate.slice(0, 10) + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { ...options, timeZone: TZ });
}

/**
 * Relative label + actual date in EST for a due date (e.g. { label: 'Tomorrow', actual: 'Wed, Feb 26' }).
 */
export function formatDateLabelEST(todayEST, isoDate) {
  if (!isoDate) return { label: '', actual: '' };
  const diff = dayDiffEST(todayEST, isoDate);
  const actual = formatDateEST(isoDate);
  if (diff === 0) return { label: 'Today', actual };
  if (diff === 1) return { label: 'Tomorrow', actual };
  if (diff === -1) return { label: 'Yesterday', actual };
  return { label: actual, actual };
}

/**
 * Add n calendar days in EST from a YYYY-MM-DD string; returns YYYY-MM-DD.
 */
export function addDaysEST(isoDateStr, n) {
  const d = new Date(isoDateStr.slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
