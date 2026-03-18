/**
 * SERIALIZE SIGNALS SERVICE
 *
 * Converts structured y/n ingest fields from a CSV submission into a
 * human-readable text block that can be stored in contact_engagement_log
 * as part of the INITIAL entry.
 *
 * Example output:
 *   "Prior engagement: Yes
 *    Last contact: July 2024
 *    Uses a competitor
 *    Knows our business: Yes
 *    Worked together at: Ares Capital"
 */

/**
 * Normalize a y/n/boolean-ish value to true | false | null.
 * @param {string|boolean|null|undefined} v
 * @returns {boolean|null}
 */
function toBoolean(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['y', 'yes', '1', 'true'].includes(s)) return true;
  if (['n', 'no', '0', 'false'].includes(s)) return false;
  return null;
}

/**
 * Serialize y/n ingest signals into a labeled human-readable block.
 *
 * @param {{
 *   lastContact?: string|null,
 *   awareOfBusiness?: string|null,
 *   usingCompetitor?: string|null,
 *   competitorName?: string|null,
 *   workedTogetherAt?: string|null,
 *   priorEngagement?: string|null,
 * }} signals
 * @returns {string|null} Formatted block, or null if no meaningful signals
 */
export function serializeSignals({
  lastContact,
  awareOfBusiness,
  usingCompetitor,
  competitorName,
  workedTogetherAt,
  priorEngagement,
} = {}) {
  const lines = [];

  const prior = toBoolean(priorEngagement);
  if (prior === true)  lines.push('Connected since working together: Yes');
  if (prior === false) lines.push('Connected since working together: No');

  if (lastContact?.trim()) {
    lines.push(`Last contact: ${lastContact.trim()}`);
  }

  const competitor = toBoolean(usingCompetitor);
  const compName = competitorName?.trim();
  if (competitor === true)  lines.push(compName ? `Uses a competitor: ${compName}` : 'Uses a competitor');
  if (competitor === false) lines.push('No known competitor in use');

  const aware = toBoolean(awareOfBusiness);
  if (aware === true)  lines.push('Knows our business: Yes');
  if (aware === false) lines.push('Not aware of our business');

  if (workedTogetherAt?.trim()) {
    lines.push(`Worked together at: ${workedTogetherAt.trim()}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
