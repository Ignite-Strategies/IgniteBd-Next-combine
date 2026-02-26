/**
 * Single source of truth for off-platform delivery methods.
 * Used by: record-off-platform page (form + save), contact page (email history display).
 */

export const DELIVERY_METHODS = ['email', 'linkedin', 'in-person'];

export function normalizeDeliveryMethod(v) {
  return v && DELIVERY_METHODS.includes(v) ? v : 'email';
}

/** Display label for UI. Maps legacy values (gmail, manual, etc.) to canonical "Email". */
export function formatDeliveryMethodLabel(platform) {
  if (!platform) return 'Email';
  const p = platform.toLowerCase();
  if (p === 'linkedin') return 'LinkedIn';
  if (p === 'in-person') return 'In Person';
  return 'Email';
}
