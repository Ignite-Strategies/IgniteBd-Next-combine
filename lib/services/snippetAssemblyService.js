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
  // Filter active snippets
  const activeSnippets = availableSnippets.filter((s) => s.isActive);

  // Group snippets by type
  const byType = {
    subject: [],
    opening: [],
    service: [],
    competitor: [],
    value: [],
    cta: [],
    relationship: [],
    generic: [],
  };

  activeSnippets.forEach((snippet) => {
    if (byType[snippet.snipType]) {
      byType[snippet.snipType].push(snippet);
    }
  });

  // Assembly logic based on relationship context
  const selected = {
    subject: null,
    opening: null,
    service: null,
    competitor: null,
    value: null,
    cta: null,
    relationship: null,
  };

  // 1. Select subject line
  if (byType.subject.length > 0) {
    selected.subject = selectBestMatch(byType.subject, personaSlug);
  }

  // 2. Select opening based on persona slug
  if (byType.opening.length > 0) {
    selected.opening = selectOpeningForPersona(byType.opening, personaSlug);
  }

  // 3. Select service/value snippets
  if (byType.service.length > 0) {
    selected.service = selectBestMatch(byType.service, personaSlug);
  }
  if (byType.value.length > 0) {
    selected.value = selectBestMatch(byType.value, personaSlug);
  }

  // 4. Select competitor snippet if persona suggests competitor context
  if (
    personaSlug?.includes('Competitor') &&
    byType.competitor.length > 0
  ) {
    selected.competitor = selectBestMatch(byType.competitor, personaSlug);
  }

  // 5. Select CTA based on persona slug
  if (byType.cta.length > 0) {
    selected.cta = selectCTAByPersona(byType.cta, personaSlug);
  }

  // 6. Select relationship snippet if persona suggests prior relationship
  if (
    (personaSlug?.includes('Former') || personaSlug?.includes('Prior')) &&
    byType.relationship.length > 0
  ) {
    selected.relationship = selectBestMatch(byType.relationship, personaSlug);
  }

  // Build ordered list for template
  const ordered = [];
  if (selected.opening) ordered.push(selected.opening);
  if (selected.relationship) ordered.push(selected.relationship);
  if (selected.service) ordered.push(selected.service);
  if (selected.value) ordered.push(selected.value);
  if (selected.competitor) ordered.push(selected.competitor);
  if (selected.cta) ordered.push(selected.cta);

  return {
    subject: selected.subject,
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

  // First try to match by assembly helper personas
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
 * Select best match considering assembly helper personas
 * Snippets can match if their assemblyHelperPersonas array includes the contact's persona slug
 */
function selectBestMatch(snippets, personaSlug) {
  if (!personaSlug || snippets.length === 0) {
    return snippets[0] || null;
  }

  // Prefer snippets whose assemblyHelperPersonas array includes this persona slug
  const personaMatch = snippets.find(
    (s) => s.assemblyHelperPersonas && s.assemblyHelperPersonas.includes(personaSlug),
  );
  if (personaMatch) return personaMatch;

  // Fall back to snippets with no helper personas (general snippets)
  const generalMatch = snippets.find(
    (s) => !s.assemblyHelperPersonas || s.assemblyHelperPersonas.length === 0,
  );
  if (generalMatch) return generalMatch;

  // Fall back to first available
  return snippets[0] || null;
}

/**
 * Generate reasoning for selected snippets
 */
function generateReasoning(personaSlug, selected) {
  const parts = [];

  if (selected.opening) {
    parts.push(
      `Selected opening "${selected.opening.snipName}" for ${personaSlug || 'general'} persona`,
    );
  }

  if (personaSlug && selected.service) {
    parts.push(
      `Selected service snippet "${selected.service.snipName}" for ${personaSlug} persona`,
    );
  }

  if (personaSlug?.includes('LongTime') && selected.cta) {
    parts.push(
      `Selected soft CTA "${selected.cta.snipName}" for long-dormant relationship`,
    );
  }

  return parts.join('. ') || 'Snippets selected based on persona';
}
