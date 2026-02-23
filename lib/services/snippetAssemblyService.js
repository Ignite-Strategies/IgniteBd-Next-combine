/**
 * Snippet Assembly Service
 * Persona-aware service that selects and orders snippets for template building
 * 
 * Snippets are independent building blocks. This service uses persona slugs
 * to intelligently select and order snippets for a given outreach scenario.
 */

/**
 * Assemble snippets for a template based on persona slug
 * 
 * @param {Object} params
 * @param {string} params.personaSlug - Persona slug (e.g., "FormerColleagueNowReachingoutAgainAfterLongTime")
 * @param {string[]} params.availableSnippets - Array of snippet objects from DB
 * @returns {Object} - Assembled template structure
 */
export function assembleSnippetsForTemplate({
  personaSlug,
  availableSnippets = [],
}) {
  const activeSnippets = availableSnippets;

  // Group snippets by template position (where in the email they belong)
  const byPosition = {};
  const POSITIONS = ['SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];
  POSITIONS.forEach((p) => { byPosition[p] = []; });

  activeSnippets.forEach((snippet) => {
    if (byPosition[snippet.templatePosition]) {
      byPosition[snippet.templatePosition].push(snippet);
    }
  });

  const selected = {};
  POSITIONS.forEach((p) => { selected[p] = null; });

  // 1. Subject line
  if (byPosition.SUBJECT_LINE.length > 0) {
    selected.SUBJECT_LINE = selectBestMatch(byPosition.SUBJECT_LINE, personaSlug);
  }

  // 2. Opening greeting
  if (byPosition.OPENING_GREETING.length > 0) {
    selected.OPENING_GREETING = selectOpeningForPersona(byPosition.OPENING_GREETING, personaSlug);
  }

  // 3–8. Body positions in template order
  if (byPosition.CATCH_UP.length > 0) selected.CATCH_UP = selectBestMatch(byPosition.CATCH_UP, personaSlug);
  if (byPosition.BUSINESS_CONTEXT.length > 0) selected.BUSINESS_CONTEXT = selectBestMatch(byPosition.BUSINESS_CONTEXT, personaSlug);
  if (byPosition.VALUE_PROPOSITION.length > 0) selected.VALUE_PROPOSITION = selectBestMatch(byPosition.VALUE_PROPOSITION, personaSlug);
  if (personaSlug?.includes('Competitor') && byPosition.COMPETITOR_FRAME.length > 0) {
    selected.COMPETITOR_FRAME = selectBestMatch(byPosition.COMPETITOR_FRAME, personaSlug);
  }
  if (byPosition.TARGET_ASK.length > 0) selected.TARGET_ASK = selectCTAByPersona(byPosition.TARGET_ASK, personaSlug);
  if (byPosition.SOFT_CLOSE.length > 0) selected.SOFT_CLOSE = selectBestMatch(byPosition.SOFT_CLOSE, personaSlug);

  // Build ordered list for body (subject is separate)
  const bodyOrder = ['OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE'];
  const ordered = bodyOrder.map((p) => selected[p]).filter(Boolean);

  return {
    subject: selected.SUBJECT_LINE,
    bodySnippets: ordered,
    reasoning: generateReasoning(personaSlug, selected),
  };
}

/**
 * Select best opening snippet for persona slug
 */
function selectOpeningForPersona(openings, personaSlug) {
  if (!personaSlug) {
    return openings[0] || null;
  }

  const personaMatch = selectBestMatch(openings, personaSlug);
  if (personaMatch) return personaMatch;

  // Fall back to name-based heuristics if no persona match
  // For long dormant relationships, prefer reconnection openings
  if (personaSlug.includes('LongTime') || personaSlug.includes('Stale')) {
    const reconnect = openings.find((s) =>
      s.snipName.includes('reconnect') || s.snipName.includes('dormant') || s.snipName.includes('long'),
    );
    if (reconnect) return reconnect;
  }

  // For prior colleagues/conversations, prefer context-aware openings
  if (personaSlug.includes('Former') || personaSlug.includes('Prior')) {
    const prior = openings.find((s) =>
      s.snipName.includes('prior') || s.snipName.includes('conversation') || s.snipName.includes('former'),
    );
    if (prior) return prior;
  }

  // Fall back to first available
  return openings[0] || null;
}

/**
 * Select best CTA based on persona slug
 */
function selectCTAByPersona(ctas, personaSlug) {
  if (!personaSlug) {
    return ctas[0] || null;
  }

  // For new/cold outreach, more direct CTAs
  if (personaSlug.includes('New') || personaSlug.includes('Cold')) {
    const direct = ctas.find((s) =>
      s.snipName.includes('calendar') || s.snipName.includes('call'),
    );
    if (direct) return direct;
  }

  // For stale/dormant, softer CTAs
  if (personaSlug.includes('Stale') || personaSlug.includes('LongTime')) {
    const soft = ctas.find((s) =>
      s.snipName.includes('worthwhile') || s.snipName.includes('welcome'),
    );
    if (soft) return soft;
  }

  return selectBestMatch(ctas, personaSlug);
}

/**
 * Select best match using personaSlug (and optionally bestUsedWhen).
 * Prefer snippets whose personaSlug matches; then general (no personaSlug); then first.
 */
function selectBestMatch(snippets, personaSlug) {
  if (!personaSlug || snippets.length === 0) {
    return snippets[0] || null;
  }

  const personaMatch = snippets.find((s) => s.personaSlug && s.personaSlug === personaSlug);
  if (personaMatch) return personaMatch;

  const generalMatch = snippets.find((s) => !s.personaSlug || s.personaSlug === '');
  if (generalMatch) return generalMatch;

  return snippets[0] || null;
}

/**
 * Generate reasoning for selected snippets
 */
function generateReasoning(personaSlug, selected) {
  const parts = [];

  if (selected.OPENING_GREETING) {
    parts.push(
      `Selected opening "${selected.OPENING_GREETING.snipName}" for ${personaSlug || 'general'} persona`,
    );
  }

  if (personaSlug && selected.BUSINESS_CONTEXT) {
    parts.push(
      `Selected business context "${selected.BUSINESS_CONTEXT.snipName}" for ${personaSlug} persona`,
    );
  }

  if (personaSlug?.includes('LongTime') && selected.TARGET_ASK) {
    parts.push(
      `Selected ask "${selected.TARGET_ASK.snipName}" for long-dormant relationship`,
    );
  }

  return parts.join('. ') || 'Snippets selected based on persona';
}
